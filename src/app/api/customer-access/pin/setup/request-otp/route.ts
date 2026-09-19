import { NextResponse } from "next/server";
import { z } from "zod";
import { CustomerAccessService } from "@/lib/customer-access/service";
import { AUTH_RULES, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export const dynamic = "force-dynamic";

const requestOtpSchema = z.object({
  phone: z.string().min(8, "Informe um telefone válido."),
});

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const userAgent = request.headers.get("user-agent") || undefined;

    const limit = await consumeRateLimit(`customer-pin-setup-otp:ip:${ip}`, AUTH_RULES.passwordReset);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

    const body = await request.json().catch(() => null);
    const parsed = requestOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const result = await CustomerAccessService.requestPinSetupOtp({
      phone: parsed.data.phone,
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao enviar código de verificação.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
