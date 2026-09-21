import { NextResponse } from "next/server";
import { z } from "zod";
import { CustomerAccessService } from "@/lib/customer-access/service";
import { AUTH_RULES, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export const dynamic = "force-dynamic";

const identifySchema = z.object({
  name: z.string().min(2, "Informe seu nome completo."),
  phone: z.string().min(8, "Informe seu número com DDD."),
  email: z.string().email("Informe um e-mail válido.").optional().or(z.literal("")),
  photoUrl: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const limit = await consumeRateLimit(`customer-identify:ip:${ip}`, AUTH_RULES.register);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

    const body = await request.json().catch(() => null);
    const parsed = identifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const result = await CustomerAccessService.quickIdentifyCustomer({
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
      photoUrl: parsed.data.photoUrl,
    });

    return NextResponse.json({
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao identificar cliente.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
