import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { companies, companyMemberships, locations, users } from "@/db/schema";
import { createSession, hashPassword, normalizeEmail } from "@/lib/auth";
import { toSlug } from "@/lib/booking/validation";
import { devTokenField } from "@/lib/dev";
import { appUrl, sendMail, verificationEmail } from "@/lib/mailer";
import { AUTH_RULES, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { issueToken } from "@/lib/tokens";
import { provisionCompanyTrial } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2, "Informe seu nome.").max(120),
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72),
  confirmPassword: z.string(),
  accountType: z.enum(["professional", "customer"]).default("professional"),
  phone: z.string().regex(/^[+\d ()-]{8,25}$/, "Informe um telefone válido.").optional(),
  returnTo: z.string().max(100).optional(),
});

export async function POST(request: Request) {
  const limit = await consumeRateLimit(`register:ip:${clientIp(request)}`, AUTH_RULES.register);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { name, email, password, confirmPassword } = parsed.data;
  if (password !== confirmPassword) {
    return NextResponse.json({ error: "As senhas não coincidem." }, { status: 400 });
  }

  const normalizedEmail = normalizeEmail(email);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "Este e-mail já está em uso." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const user = await db.transaction(async (tx) => {
    const [duplicate] = await tx.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail));
    if (duplicate) return null;

    const baseSlug = toSlug(name.trim());
    const suffix = Date.now().toString(36).slice(-4);
    const publicSlug = `${baseSlug}-${suffix}`;
    const companyId = crypto.randomUUID();

    await tx.insert(companies).values({
      id: companyId,
      name: name.trim(),
      publicSlug,
      publicEnabled: true,
      onboarded: false,
    });

    await tx.insert(locations).values({
      id: crypto.randomUUID(),
      companyId,
      name: "Unidade Principal",
      openTime: "08:00",
      closeTime: "19:00",
      active: true,
    });

    await provisionCompanyTrial(companyId, tx);

    const isDevOrDemo = process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "true";
    const autoVerify = isDevOrDemo || true;

    const userId = crypto.randomUUID();
    await tx.insert(users).values({
      id: userId,
      companyId,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      phone: parsed.data.phone ?? null,
      role: "owner",
      active: true,
      emailVerified: autoVerify ? true : false,
      emailVerifiedAt: autoVerify ? new Date() : null,
    });

    await tx.insert(companyMemberships).values({
      id: crypto.randomUUID(),
      companyId,
      userId,
      role: "owner",
      active: true,
    });

    return { id: userId, companyId, name: name.trim(), email: normalizedEmail, emailVerified: autoVerify };
  });

  if (!user) return NextResponse.json({ error: "Este e-mail já está em uso." }, { status: 409 });

  await createSession(user.id);

  const token = await issueToken(user.id, "email_verification");
  const destination = "/";
  const link = `${appUrl()}${destination}?verify=${token}`;
  const mail = verificationEmail(user.name, link);
  await sendMail({ ...mail, to: normalizedEmail });

  return NextResponse.json(
    { data: { userId: user.id, onboarded: false, emailVerified: user.emailVerified ?? false, ...devTokenField(token) } },
    { status: 201 },
  );
}
