import { NextResponse } from "next/server";
import { z } from "zod";
import { CustomerAccessService } from "@/lib/customer-access/service";
import { AUTH_RULES, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export const dynamic = "force-dynamic";

const resetRequestSchema = z.object({
  phone: z.string().min(8, "Informe seu celular com DDD."),
});

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const userAgent = request.headers.get("user-agent") || undefined;

    const limit = await consumeRateLimit(
      `customer-pin-reset-req:ip:${ip}`,
      AUTH_RULES.passwordReset,
    );
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

    const body = await request.json().catch(() => null);
    const parsed = resetRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Informe um celular válido." },
        { status: 400 },
      );
    }

    const result = await CustomerAccessService.requestPinReset({
      phone: parsed.data.phone,
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao solicitar recuperação de PIN.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
