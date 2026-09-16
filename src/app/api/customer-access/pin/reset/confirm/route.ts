import { NextResponse } from "next/server";
import { z } from "zod";
import { CustomerAccessService } from "@/lib/customer-access/service";
import { AUTH_RULES, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export const dynamic = "force-dynamic";

const resetConfirmSchema = z.object({
  phone: z.string().min(8, "Informe seu celular com DDD."),
  otp: z.string().min(6, "Informe o código de verificação recebido."),
  newPin: z.string().length(6, "O novo PIN deve ter 6 números."),
  confirmNewPin: z.string().length(6, "Confirme o novo PIN com 6 números."),
});

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const userAgent = request.headers.get("user-agent") || undefined;

    const limit = await consumeRateLimit(
      `customer-pin-reset-conf:ip:${ip}`,
      AUTH_RULES.passwordResetConfirm,
    );
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

    const body = await request.json().catch(() => null);
    const parsed = resetConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const result = await CustomerAccessService.confirmPinReset({
      phone: parsed.data.phone,
      otp: parsed.data.otp,
      newPin: parsed.data.newPin,
      confirmNewPin: parsed.data.confirmNewPin,
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({
      data: {
        userId: result.userId,
        customer: result.customer,
        targetPortal: "/minhas-reservas",
        message: "PIN redefinido com sucesso!",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao redefinir PIN.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
