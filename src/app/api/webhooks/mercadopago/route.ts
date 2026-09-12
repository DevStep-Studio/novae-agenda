import { db } from "@/db";
import { notifications, paymentWebhookEvents, subscriptionInvoices, subscriptions, users } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { SaasCouponService } from "@/lib/saas/coupon-service";
import { MercadoPagoStatusMapper, saasPaymentProvider } from "@/lib/saas/payment-provider";
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

    // 2. Insert event record as pending/processing
    const eventId = crypto.randomUUID();
    await db.insert(paymentWebhookEvents).values({
      id: eventId,
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
            const rawStatus = paymentInfo.status as string;
            const internalStatus = MercadoPagoStatusMapper.toInternal(rawStatus);

            let ref: any = {};
            if (paymentInfo.external_reference) {
              try {
                ref = JSON.parse(paymentInfo.external_reference);
              } catch {
                ref = {};
              }
            }

            const companyId = ref.companyId;
            const planSlug = ref.planSlug || ref.planKey;
            const billingInterval = ref.billingInterval || "monthly";
            const couponId = ref.couponId;
            const invoiceId = ref.invoiceId;

            if (companyId && planSlug) {
              const amount = Number(paymentInfo.transaction_amount || 0);
              const paymentMethod = paymentInfo.payment_method_id === "pix" ? "pix" : "card";

              if (internalStatus === "APPROVED") {
                await saasPaymentProvider.activateCompanySubscription({
                  companyId,
                  planSlug,
                  billingInterval,
                  amount,
                  paymentMethod,
                  gatewayPaymentId: String(paymentId),
                  invoiceId,
                  couponId,
                });

                if (couponId || invoiceId) {
                  await SaasCouponService.confirmCouponRedemption({
                    couponId,
                    invoiceId,
                    companyId,
                  });
                }
              } else if (internalStatus === "REJECTED" || internalStatus === "CANCELLED" || internalStatus === "EXPIRED") {
                // Update invoice as failed/cancelled
                if (invoiceId) {
                  await db
                    .update(subscriptionInvoices)
                    .set({
                      status: MercadoPagoStatusMapper.toInvoiceStatus(internalStatus),
                      failedAt: new Date(),
                      gatewayStatus: rawStatus,
                      gatewayStatusDetail: paymentInfo.status_detail,
                    })
                    .where(eq(subscriptionInvoices.id, invoiceId));
                }

                if (couponId || invoiceId) {
                  await SaasCouponService.cancelCouponRedemption({
                    invoiceId,
                  });
                }

                await recordAudit({
                  companyId,
                  action: "payment.failed",
                  entity: "subscription",
                  metadata: { paymentId, status: rawStatus, detail: paymentInfo.status_detail },
                });
              }
            }
          }
        } catch (err: any) {
          console.error("[MercadoPago Webhook] Error fetching payment info:", err);
          await db
            .update(paymentWebhookEvents)
            .set({
              status: "failed",
              failedAt: new Date(),
              errorMessage: err?.message || String(err),
            })
            .where(eq(paymentWebhookEvents.id, eventId));
        }
      }
    }

    return Response.json({ received: true });
  } catch (error: any) {
    console.error("[MercadoPago Webhook] Global handler error:", error);
    return Response.json({ received: true, error: "Processed with warning" });
  }
}
