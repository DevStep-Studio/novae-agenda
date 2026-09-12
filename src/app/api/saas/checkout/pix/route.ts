import { requireRole } from "@/lib/auth";
import { saasPaymentProvider } from "@/lib/saas/payment-provider";
import { z } from "zod";

export const dynamic = "force-dynamic";

const pixSchema = z.object({
  planSlug: z.string().min(1, "Selecione um plano válido."),
  billingInterval: z.enum(["monthly", "yearly"]).default("monthly"),
  couponCode: z.string().optional(),
});

export async function POST(request: Request) {
  const gate = await requireRole("owner");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const body = await request.json().catch(() => null);
  const parsed = pixSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  try {
    const result = await saasPaymentProvider.createPixPayment({
      companyId: auth.user.companyId,
      planSlug: parsed.data.planSlug,
      billingInterval: parsed.data.billingInterval,
      couponCode: parsed.data.couponCode,
      payerEmail: auth.user.email,
      payerName: auth.user.name,
    });

    return Response.json({ data: result }, { status: 201 });
  } catch (error: any) {
    console.error("[SaaS PIX Checkout API] Error generating PIX:", error);
    const statusCode = error.statusCode || 500;
    return Response.json(
      { error: error.message || "Não foi possível gerar a cobrança PIX. Tente novamente." },
      { status: statusCode }
    );
  }
}
