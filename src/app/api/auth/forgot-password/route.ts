import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { normalizeEmail } from "@/lib/auth";
import { devTokenField } from "@/lib/dev";
import { appUrl, passwordResetEmail, sendMail } from "@/lib/mailer";
import { AUTH_RULES, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { issueToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email("Informe um e-mail válido."),
});

const GENERIC_MESSAGE =
  "Se o e-mail informado estiver cadastrado, você receberá as instruções para redefinir sua senha.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Informe um e-mail válido." }, { status: 400 });
  }

  const normalized = normalizeEmail(parsed.data.email);

  for (const bucket of [`pwreset:ip:${clientIp(request)}`, `pwreset:email:${normalized}`]) {
    const limit = await consumeRateLimit(bucket, AUTH_RULES.passwordReset);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);
  }

  const [user] = await db
    .select({ id: users.id, name: users.name, active: users.active })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  // Only send when the account exists and is active — but never disclose which case it was.
  let devToken: Record<string, string> = {};
  if (user && user.active) {
    const token = await issueToken(user.id, "password_reset");
    const link = `${appUrl()}/?reset=${token}`;
    const mail = passwordResetEmail(user.name, link);
    await sendMail({ ...mail, to: normalized });
    devToken = devTokenField(token);
  }

  return NextResponse.json({ data: { success: true, message: GENERIC_MESSAGE, ...devToken } });
}
