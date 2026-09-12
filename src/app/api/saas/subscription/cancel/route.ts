import { requireRole } from "@/lib/auth";
import { saasPaymentProvider } from "@/lib/saas/payment-provider";
import { z } from "zod";

export const dynamic = "force-dynamic";

const cancelSchema = z.object({
  cancelImmediately: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const gate = await requireRole("owner");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const body = await request.json().catch(() => ({}));
  const parsed = cancelSchema.safeParse(body);
  const cancelImmediately = parsed.success ? parsed.data.cancelImmediately : false;

  try {
    await saasPaymentProvider.cancelSubscription(auth.user.companyId, cancelImmediately);
    return Response.json({
      data: {
        success: true,
        message: cancelImmediately
          ? "Assinatura cancelada com sucesso."
          : "Sua assinatura foi cancelada e continuará disponível até o fim do período atual.",
      },
    });
  } catch (error: any) {
    console.error("[SaaS Cancel API] Error cancelling subscription:", error);
    return Response.json(
      { error: error.message || "Erro ao cancelar assinatura." },
      { status: 500 }
    );
  }
}
