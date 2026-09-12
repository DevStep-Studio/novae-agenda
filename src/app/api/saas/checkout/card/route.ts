import { requireRole } from "@/lib/auth";
import { saasPaymentProvider } from "@/lib/saas/payment-provider";
import { z } from "zod";

export const dynamic = "force-dynamic";

const cardSchema = z.object({
  planSlug: z.string().min(1, "Selecione um plano válido."),
  billingInterval: z.enum(["monthly", "yearly"]).default("monthly"),
  cardToken: z.string().optional(),
  paymentMethodId: z.string().optional(),
  installments: z.number().int().min(1).max(12).optional().default(1),
  couponCode: z.string().optional(),
});

export async function POST(request: Request) {
  const gate = await requireRole("owner");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const body = await request.json().catch(() => null);
  const parsed = cardSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  try {
    const result = await saasPaymentProvider.createCardPayment({
      companyId: auth.user.companyId,
      planSlug: parsed.data.planSlug,
      billingInterval: parsed.data.billingInterval,
      cardToken: parsed.data.cardToken,
      paymentMethodId: parsed.data.paymentMethodId,
      installments: parsed.data.installments,
      couponCode: parsed.data.couponCode,
      payerEmail: auth.user.email,
      payerName: auth.user.name,
    });

    if (result.status === "approved") {
      return Response.json({
        data: {
          approved: true,
          status: result.status,
          paymentId: result.paymentId,
          subtotal: result.subtotal,
          discount: result.discount,
          amount: result.amount,
          isFreeWithCoupon: result.isFreeWithCoupon,
          message: result.isFreeWithCoupon
            ? "Cupom de 100% aplicado! Sua assinatura foi ativada com sucesso."
            : "Pagamento aprovado com sucesso! Sua assinatura está ativa.",
        },
      });
    }

    if (result.status === "in_process" || result.status === "pending") {
      return Response.json({
        data: {
          approved: false,
          status: result.status,
          paymentId: result.paymentId,
          subtotal: result.subtotal,
          discount: result.discount,
          amount: result.amount,
          message: "Estamos confirmando seu pagamento. A liberação ocorrerá assim que processado.",
        },
      });
    }

    return Response.json(
      {
        data: {
          approved: false,
          status: result.status,
          statusDetail: result.statusDetail,
          message: "Não foi possível concluir o pagamento. Verifique os dados do cartão ou utilize outra forma de pagamento.",
        },
      },
      { status: 402 }
    );
  } catch (error: any) {
    console.error("[SaaS Card Checkout API] Error processing card payment:", error);
    const statusCode = error.statusCode || 500;
    return Response.json(
      { error: error.message || "Não foi possível processar o pagamento com cartão. Tente novamente." },
      { status: statusCode }
    );
  }
}
