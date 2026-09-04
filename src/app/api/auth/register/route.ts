import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { companies, users } from "@/db/schema";
import { createSession, hashPassword, normalizeEmail } from "@/lib/auth";
import { devTokenField } from "@/lib/dev";
import { appUrl, sendMail, verificationEmail } from "@/lib/mailer";
import { AUTH_RULES, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { issueToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2, "Informe seu nome.").max(120),
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72),
  confirmPassword: z.string(),
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

  const [company] = await db.insert(companies).values({ name: name.trim(), onboarded: false }).returning();
  const [user] = await db
    .insert(users)
    .values({
      companyId: company.id,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "owner",
      active: true,
      emailVerified: false,
    })
    .returning();

  await createSession(user.id);

  const token = await issueToken(user.id, "email_verification");
  const link = `${appUrl()}/?verify=${token}`;
  const mail = verificationEmail(user.name, link);
  await sendMail({ ...mail, to: normalizedEmail });

  return NextResponse.json(
    { data: { userId: user.id, onboarded: false, emailVerified: false, ...devTokenField(token) } },
    { status: 201 },
  );
}
