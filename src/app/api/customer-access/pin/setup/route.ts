import { NextResponse } from "next/server";
import { z } from "zod";
import { getIdentity } from "@/lib/auth";
import { CustomerAccessService } from "@/lib/customer-access/service";
import { AUTH_RULES, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export const dynamic = "force-dynamic";

const pinSetupSchema = z.object({
  pin: z.string().length(6, "O PIN deve conter exatamente 6 números."),
  confirmPin: z.string().length(6, "Confirme o PIN com 6 números."),
  phone: z.string().optional(),
  bookingId: z.string().uuid().optional(),
  otpToken: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const userAgent = request.headers.get("user-agent") || undefined;

    const limit = await consumeRateLimit(`customer-pin-setup:ip:${ip}`, AUTH_RULES.register);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

    const body = await request.json().catch(() => null);
    const parsed = pinSetupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const currentSessionUser = await getIdentity();

    const result = await CustomerAccessService.setupPin({
      phone: parsed.data.phone,
      pin: parsed.data.pin,
      confirmPin: parsed.data.confirmPin,
      bookingId: parsed.data.bookingId,
      otpToken: parsed.data.otpToken,
      authenticatedUserId: currentSessionUser?.id,
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({
      data: {
        userId: result.userId,
        customer: result.customer,
        targetPortal: "/minhas-reservas",
        message: "PIN criado com sucesso!",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar PIN.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
