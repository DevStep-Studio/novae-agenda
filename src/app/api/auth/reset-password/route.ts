import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { AUTH_RULES, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { consumeToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(20, "Link de redefinição inválido."),
  newPassword: z.string().min(8, "A nova senha precisa ter pelo menos 8 caracteres.").max(72),
  confirmPassword: z.string(),
});

export async function POST(request: Request) {
  const limit = await consumeRateLimit(`pwreset-confirm:ip:${clientIp(request)}`, AUTH_RULES.passwordResetConfirm);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { token, newPassword, confirmPassword } = parsed.data;
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "As senhas não coincidem." }, { status: 400 });
  }

  const consumed = await consumeToken(token, "password_reset");
  if (!consumed) {
    return NextResponse.json(
      { error: "Este link de redefinição é inválido ou expirou. Solicite um novo." },
      { status: 400 },
    );
  }

  const [user] = await db
    .select({ id: users.id, companyId: users.companyId, active: users.active })
    .from(users)
    .where(eq(users.id, consumed.userId))
    .limit(1);

  if (!user || !user.active) {
    return NextResponse.json({ error: "Conta de usuário não encontrada ou inativa." }, { status: 404 });
  }

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));
  await recordAudit({
    companyId: user.companyId,
    userId: user.id,
    action: "auth.password_reset",
    entity: "user",
    entityId: user.id,
  });

  return NextResponse.json({
    data: { success: true, message: "Senha atualizada com sucesso! Você já pode entrar com sua nova senha." },
  });
}
