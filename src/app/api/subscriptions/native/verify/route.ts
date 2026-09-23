import { NextResponse } from "next/server";
import { z } from "zod";
import { getIdentity } from "@/lib/auth";
import { SubscriptionEntitlementService } from "@/lib/subscriptions/entitlement-service";

export const dynamic = "force-dynamic";

const verifySchema = z.object({
  platform: z.enum(["ios", "android"]),
  productId: z.string().min(1, "Product ID é obrigatório."),
  token: z.string().min(1, "Token de recibo ou compra é obrigatório."),
  orderId: z.string().optional(),
  originalTransactionId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await getIdentity();
    if (!user || user.role !== "owner" || !user.companyId) {
      return NextResponse.json({ error: "Apenas proprietários podem gerenciar assinaturas." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Dados inválidos." }, { status: 400 });
    }

    let entitlement;

    if (parsed.data.platform === "ios") {
      entitlement = await SubscriptionEntitlementService.applyAppleSubscription({
        companyId: user.companyId,
        productId: parsed.data.productId,
        transactionId: parsed.data.token,
        originalTransactionId: parsed.data.originalTransactionId || parsed.data.token,
      });
    } else {
      entitlement = await SubscriptionEntitlementService.applyGoogleSubscription({
        companyId: user.companyId,
        productId: parsed.data.productId,
        purchaseToken: parsed.data.token,
        orderId: parsed.data.orderId || crypto.randomUUID(),
      });
    }

    return NextResponse.json({
      data: {
        success: true,
        entitlement,
      },
    });
  } catch (error) {
    console.error("[subscriptions/native/verify] Erro:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao validar assinatura nativa." },
      { status: 500 },
    );
  }
}
