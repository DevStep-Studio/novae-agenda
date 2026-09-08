import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getIdentity } from "@/lib/auth";
import { devTokenField } from "@/lib/dev";
import { appUrl, sendMail, verificationEmail } from "@/lib/mailer";
import { AUTH_RULES, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { issueToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getIdentity();
  if (!session) {
    return NextResponse.json({ error: "Entre na sua conta para reenviar a confirmação." }, { status: 401 });
  }

  for (const bucket of [`emailresend:ip:${clientIp(request)}`, `emailresend:user:${session.id}`]) {
    const limit = await consumeRateLimit(bucket, AUTH_RULES.emailVerify);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);
  }

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);

  if (!user) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  if (user.emailVerified) {
    return NextResponse.json({ data: { success: true, message: "Seu e-mail já está confirmado." } });
  }

  const token = await issueToken(user.id, "email_verification");
  const body = await request.json().catch(() => ({}));
  const destination = session.role === "customer" ? (/^\/agendar\/[a-z0-9-]+$/.test(body.returnTo ?? "") ? body.returnTo : "/meus-agendamentos") : "/";
  const link = `${appUrl()}${destination}?verify=${token}`;
  const mail = verificationEmail(user.name, link);
  await sendMail({ ...mail, to: user.email });

  return NextResponse.json({
    data: { success: true, message: "Enviamos um novo link de confirmação.", ...devTokenField(token) },
  });
}
