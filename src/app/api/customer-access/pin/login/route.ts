import { NextResponse } from "next/server";
import { z } from "zod";
import { CustomerAccessService, hashPinLookup } from "@/lib/customer-access/service";
import { normalizePhoneDigits } from "@/lib/domain";
import { AUTH_RULES, clearRateLimit, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export const dynamic = "force-dynamic";

const pinLoginSchema = z.object({
  pin: z.string().length(6, "O PIN deve conter exatamente 6 números."),
  phone: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const userAgent = request.headers.get("user-agent") || undefined;

    const body = await request.json().catch(() => null);
    const parsed = pinLoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const { phone, pin } = parsed.data;

    // Rate limiting por IP
    const ipBucket = `customer-pin-login:ip:${ip}`;
    const ipLimit = await consumeRateLimit(ipBucket, AUTH_RULES.login);
    if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfterSeconds);

    let phoneBucket: string | null = null;
    if (phone && phone.trim().length >= 8) {
      const digits = normalizePhoneDigits(phone);
      phoneBucket = `customer-pin-login:phone:${digits}`;
      const phoneLimit = await consumeRateLimit(phoneBucket, AUTH_RULES.login);
      if (!phoneLimit.ok) return tooManyRequests(phoneLimit.retryAfterSeconds);
    }

    const result = await CustomerAccessService.loginWithPin({
      phone,
      pin,
      ipAddress: ip,
      userAgent,
    });

    // Limpa os limites de taxa em caso de sucesso
    await Promise.all([
      clearRateLimit(ipBucket),
      phoneBucket ? clearRateLimit(phoneBucket) : Promise.resolve(),
    ]).catch(() => null);

    return NextResponse.json({
      data: {
        userId: result.userId,
        customer: result.customer,
        targetPortal: "/minhas-reservas",
      },
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Erro ao autenticar com PIN.";
    const status = error.needsSetup ? 400 : message.includes("bloqueada") ? 429 : 401;
    return NextResponse.json(
      {
        error: message,
        needsSetup: Boolean(error.needsSetup),
      },
      { status },
    );
  }
}
