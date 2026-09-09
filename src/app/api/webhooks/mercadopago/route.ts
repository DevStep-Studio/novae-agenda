import { activateSubscription } from "@/lib/mercadopago";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ received: true });

    // Handle Mercado Pago payment or subscription event
    const action = body.action || body.type;
    const data = body.data || {};

    if (action === "payment.created" || action === "payment.updated" || action === "payment") {
      const paymentId = data.id || body.id;
      // In a live environment, we verify the payment status with Mercado Pago API:
      const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
      if (token && paymentId) {
        try {
          const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const paymentInfo = await res.json();
            if (paymentInfo.status === "approved" && paymentInfo.external_reference) {
              const ref = JSON.parse(paymentInfo.external_reference);
              if (ref.companyId && ref.planKey) {
                await activateSubscription(ref.companyId, ref.planKey, String(paymentId), paymentInfo.transaction_amount);
                await recordAudit({
                  companyId: ref.companyId,
                  action: "subscription.paid",
                  entity: "subscription",
                  metadata: { paymentId, planKey: ref.planKey, amount: paymentInfo.transaction_amount },
                });
              }
            }
          }
        } catch (err) {
          console.error("[MercadoPago Webhook] Error fetching payment:", err);
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("[MercadoPago Webhook] Global handler error:", error);
    return Response.json({ received: true, error: "Processed with warning" });
  }
}
