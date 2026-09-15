import crypto from "node:crypto";
import { db } from "@/db";
import { notifications, paymentWebhookEvents, subscriptionInvoices, subscriptions, users } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { SaasCouponService } from "@/lib/saas/coupon-service";
import { MercadoPagoStatusMapper, saasPaymentProvider } from "@/lib/saas/payment-provider";
import { logger } from "@/lib/observability";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function verifyMercadoPagoSignature(
  request: Request,
  dataId: string,
  secret: string,
): boolean {
  try {
    const xSignature = request.headers.get("x-signature");
    const xRequestId = request.headers.get("x-request-id");
    if (!xSignature || !xRequestId) return false;

    const parts = xSignature.split(",").map((p) => p.trim());
    let ts = "";
    let hash = "";
    for (const part of parts) {
      const [key, val] = part.split("=");
      if (key === "ts") ts = val;
      if (key === "v1") hash = val;
    }

    if (!ts || !hash) return false;

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const computed = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

    const bufComputed = Buffer.from(computed);
    const bufReceived = Buffer.from(hash);
    if (bufComputed.length !== bufReceived.length) return false;
    return crypto.timingSafeEqual(bufComputed, bufReceived);
  } catch {
    return false;
  }
}

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

    // 0. Valida assinatura criptográfica x-signature se o segredo do webhook estiver configurado
    const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    if (webhookSecret && webhookSecret.trim().length > 0) {
      const isSignatureValid = verifyMercadoPagoSignature(request, paymentId, webhookSecret);
      if (!isSignatureValid) {
        console.warn("[MercadoPago Webhook] Invalid webhook signature rejected");
        return Response.json({ error: "Assinatura inválida." }, { status: 401 });
      }
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
          logger.webhookFailure("mercadopago", eventUniqueId, err, { paymentId, action });
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
    logger.webhookFailure("mercadopago", "global_catch", error);
    return Response.json({ received: true, error: "Processed with warning" });
  }
}
