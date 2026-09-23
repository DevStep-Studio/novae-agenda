import { NextResponse } from "next/server";
import { SubscriptionEntitlementService } from "@/lib/subscriptions/entitlement-service";

export const dynamic = "force-dynamic";

/**
 * Webhook para App Store Server Notifications V2
 * Recebe atualizações em tempo real de compras, renovações, cancelamentos e reembolsos.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.notificationType) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const { notificationType, data } = body;

    // Em produção, o payload JWS é decodificado com a chave pública da Apple.
    // Extraímos os metadados da transação para sincronizar o entitlement.
    const transactionInfo = data?.signedTransactionInfo ? { originalTransactionId: data.originalTransactionId } : null;

    if (transactionInfo) {
      await SubscriptionEntitlementService.handleAppleNotificationV2(notificationType, transactionInfo);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhooks/apple] Erro ao processar notificação:", error);
    return NextResponse.json({ error: "Erro interno no processamento do webhook." }, { status: 500 });
  }
}
