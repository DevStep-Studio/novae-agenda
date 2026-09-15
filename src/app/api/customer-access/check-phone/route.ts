import { NextResponse } from "next/server";
import { z } from "zod";
import { CustomerAccessService } from "@/lib/customer-access/service";
import { AUTH_RULES, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export const dynamic = "force-dynamic";

const checkPhoneSchema = z.object({
  phone: z.string().min(8, "Informe um número de celular válido com DDD."),
});

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const limit = await consumeRateLimit(`customer-check-phone:ip:${ip}`, AUTH_RULES.login);
    if (!limit.ok) {
      return tooManyRequests(limit.retryAfterSeconds);
    }

    const body = await request.json().catch(() => null);
    const parsed = checkPhoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Número de celular inválido." },
        { status: 400 },
      );
    }

    const result = await CustomerAccessService.checkPhone(parsed.data.phone);
    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao consultar celular.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
