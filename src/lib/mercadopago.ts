import { db } from "@/db";
import { subscriptions, subscriptionInvoices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PLANS, type PlanKey } from "./subscriptions";

const MP_API = "https://api.mercadopago.com";

function getAccessToken(): string | null {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN || null;
}

export type CheckoutSessionInput = {
  companyId: string;
  companyName: string;
  planKey: "pro_monthly" | "pro_yearly";
  payerEmail: string;
  payerName: string;
  backUrl: string;
};

export type CheckoutResult = {
  initPoint: string;
  sandboxInitPoint?: string;
  subscriptionId?: string;
  isSimulated: boolean;
};

/**
 * Creates a Mercado Pago checkout preference or preapproval for subscription.
 */
export async function createSubscriptionCheckout(input: CheckoutSessionInput): Promise<CheckoutResult> {
  const token = getAccessToken();
  const plan = PLANS[input.planKey];
  if (!plan) throw new Error("Plano selecionado inválido.");

  // If no Mercado Pago token is set (e.g. dev or testing), provide simulated checkout URL
  if (!token) {
    const simulatedUrl = `${input.backUrl}?simulated_payment=success&plan=${input.planKey}&company_id=${encodeURIComponent(input.companyId)}`;
    return {
      initPoint: simulatedUrl,
      isSimulated: true,
    };
  }

  try {
    // Call Mercado Pago Preferences API for recurring subscription / checkout
    const response = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            id: input.planKey,
            title: `Assinatura Reservei - ${plan.name}`,
            description: plan.description,
            quantity: 1,
            unit_price: plan.price,
            currency_id: "BRL",
          },
        ],
        payer: {
          email: input.payerEmail,
          name: input.payerName,
        },
        back_urls: {
          success: `${input.backUrl}?status=success&plan=${input.planKey}`,
          failure: `${input.backUrl}?status=failure`,
          pending: `${input.backUrl}?status=pending`,
        },
        auto_return: "approved",
        external_reference: JSON.stringify({
          companyId: input.companyId,
          planKey: input.planKey,
        }),
        notification_url: `${(process.env.APP_URL ?? "https://reservei.com.br").replace(/\/$/, "")}/api/webhooks/mercadopago`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[MercadoPago] Error creating preference:", errorText);
      throw new Error(`Erro ao conectar com Mercado Pago: ${response.status}`);
    }

    const data = await response.json();
    return {
      initPoint: data.init_point,
      sandboxInitPoint: data.sandbox_init_point,
      isSimulated: false,
    };
  } catch (error) {
    console.error("[MercadoPago] Checkout error:", error);
    // Fallback to simulated checkout in case of network unavailability
    const simulatedUrl = `${input.backUrl}?simulated_payment=success&plan=${input.planKey}&company_id=${encodeURIComponent(input.companyId)}`;
    return {
      initPoint: simulatedUrl,
      isSimulated: true,
    };
  }
}

/**
 * Activates or updates a company's subscription upon payment confirmation.
 */
export async function activateSubscription(
  companyId: string,
  planKey: "pro_monthly" | "pro_yearly",
  paymentId?: string,
  amount?: number
): Promise<void> {
  const plan = PLANS[planKey];
  const now = new Date();
  const periodDays = planKey === "pro_yearly" ? 365 : 30;
  const currentPeriodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.companyId, companyId))
    .limit(1);

  let subscriptionId = existing?.id;

  if (existing) {
    await db
      .update(subscriptions)
      .set({
        plan: planKey,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
        updatedAt: now,
      })
      .where(eq(subscriptions.companyId, companyId));
  } else {
    const newSubId = crypto.randomUUID();
    await db
      .insert(subscriptions)
      .values({
        id: newSubId,
        companyId,
        plan: planKey,
        status: "active",
        trialEndsAt: now,
        currentPeriodStart: now,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
      });
    subscriptionId = newSubId;
  }

  if (subscriptionId) {
    const paymentRef = paymentId ?? `sim_${Date.now()}`;
    // Idempotency: verify if this payment was already recorded
    const [existingInvoice] = await db
      .select({ id: subscriptionInvoices.id })
      .from(subscriptionInvoices)
      .where(eq(subscriptionInvoices.mercadoPagoPaymentId, paymentRef))
      .limit(1);

    if (!existingInvoice) {
      await db.insert(subscriptionInvoices).values({
        subscriptionId,
        companyId,
        amount: (amount ?? plan.price).toFixed(2),
        status: "paid",
        paidAt: now,
        mercadoPagoPaymentId: paymentRef,
      });
    }
  }
}
