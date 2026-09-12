import { requireRole } from "@/lib/auth";
import { saasPaymentProvider } from "@/lib/saas/payment-provider";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireRole("owner");
  if (gate.response) return gate.response;
  const { auth } = gate;

  try {
    await saasPaymentProvider.reactivateSubscription(auth.user.companyId);
    return Response.json({
      data: {
        success: true,
        message: "Assinatura reativada com sucesso. A renovação continuará normalmente.",
      },
    });
  } catch (error: any) {
    console.error("[SaaS Reactivate API] Error reactivating subscription:", error);
    return Response.json(
      { error: error.message || "Erro ao reativar assinatura." },
      { status: 500 }
    );
  }
}
