import { db } from "@/db";
import { notifications, paymentWebhookEvents, users } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { saasPaymentProvider } from "@/lib/saas/payment-provider";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ received: true });

    const action = body.action || body.type || "payment";
    const data = body.data || {};
    const paymentId = String(data.id || body.id || "");

    if (!paymentId) {
      return Response.json({ received: true, note: "No payment id" });
    }

    const eventUniqueId = `${paymentId}_${action}`;

    // 1. Idempotency check with paymentWebhookEvents
    const [existingEvent] = await db
      .select()
      .from(paymentWebhookEvents)
      .where(
        and(
          eq(paymentWebhookEvents.gateway, "mercadopago"),
          eq(paymentWebhookEvents.eventId, eventUniqueId)
        )
      )
      .limit(1);

    if (existingEvent) {
      return Response.json({ received: true, idempotent: true });
    }

    // 2. Insert event record as processed
    await db.insert(paymentWebhookEvents).values({
      id: crypto.randomUUID(),
      gateway: "mercadopago",
      eventId: eventUniqueId,
      type: action,
      payload: body,
      status: "processed",
      processedAt: new Date(),
    });

    // 3. Process payment event
    if (action === "payment.created" || action === "payment.updated" || action === "payment") {
      const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
      if (token && !token.startsWith("TEST-SIMULATED")) {
        try {
          const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (res.ok) {
            const paymentInfo = await res.json();
            if (paymentInfo.status === "approved" && paymentInfo.external_reference) {
              let ref: any = {};
              try {
                ref = JSON.parse(paymentInfo.external_reference);
              } catch {
                ref = {};
              }

              const companyId = ref.companyId;
              const planSlug = ref.planSlug || ref.planKey;
              const billingInterval = ref.billingInterval || "monthly";

              if (companyId && planSlug) {
                const amount = Number(paymentInfo.transaction_amount || 0);
                const paymentMethod = paymentInfo.payment_method_id === "pix" ? "pix" : "card";

                await saasPaymentProvider.activateCompanySubscription({
                  companyId,
                  planSlug,
                  billingInterval,
                  amount,
                  paymentMethod,
                  gatewayPaymentId: String(paymentId),
                  invoiceId: ref.invoiceId,
                });

                // Notify owner
                const [owner] = await db
                  .select({ id: users.id })
                  .from(users)
                  .where(and(eq(users.companyId, companyId), eq(users.role, "owner")))
                  .limit(1);

                if (owner) {
                  await db.insert(notifications).values({
                    id: crypto.randomUUID(),
                    companyId,
                    userId: owner.id,
                    type: "subscription_active",
                    title: "Pagamento de assinatura aprovado!",
                    body: `Seu pagamento de R$ ${amount.toFixed(2)} foi confirmado. O plano ${planSlug.toUpperCase()} está ativo com todos os recursos liberados.`,
                    createdAt: new Date(),
                  });
                }

                await recordAudit({
                  companyId,
                  action: "subscription.paid",
                  entity: "subscription",
                  metadata: { paymentId, planSlug, amount, billingInterval },
                });
              }
            }
          }
        } catch (err) {
          console.error("[MercadoPago Webhook] Error fetching payment info:", err);
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("[MercadoPago Webhook] Global handler error:", error);
    return Response.json({ received: true, error: "Processed with warning" });
  }
}
