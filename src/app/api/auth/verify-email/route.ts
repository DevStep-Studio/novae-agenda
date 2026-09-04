import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { AUTH_RULES, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { consumeToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

const schema = z.object({ token: z.string().min(20, "Link de confirmação inválido.") });

export async function POST(request: Request) {
  const limit = await consumeRateLimit(`emailverify:ip:${clientIp(request)}`, AUTH_RULES.emailVerify);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const consumed = await consumeToken(parsed.data.token, "email_verification");
  if (!consumed) {
    return NextResponse.json(
      { error: "Este link de confirmação é inválido ou expirou. Solicite um novo." },
      { status: 400 },
    );
  }

  const [user] = await db
    .select({ id: users.id, companyId: users.companyId, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, consumed.userId))
    .limit(1);

  if (!user) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });

  if (!user.emailVerified) {
    await db
      .update(users)
      .set({ emailVerified: true, emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await recordAudit({
      companyId: user.companyId,
      userId: user.id,
      action: "auth.email_verified",
      entity: "user",
      entityId: user.id,
    });
  }

  return NextResponse.json({ data: { success: true, message: "E-mail confirmado com sucesso." } });
}
