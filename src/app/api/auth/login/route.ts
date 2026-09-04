import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, normalizeEmail, verifyPassword } from "@/lib/auth";
import { AUTH_RULES, clearRateLimit, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const normalized = normalizeEmail(email);
  const ipBucket = `login:ip:${clientIp(request)}`;
  const emailBucket = `login:email:${normalized}`;

  for (const bucket of [ipBucket, emailBucket]) {
    const limit = await consumeRateLimit(bucket, AUTH_RULES.login);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);
  }

  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash, active: users.active })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid || !user.active) {
    return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }

  await Promise.all([clearRateLimit(ipBucket), clearRateLimit(emailBucket)]);
  await createSession(user.id);
  return NextResponse.json({ data: { userId: user.id } });
}
