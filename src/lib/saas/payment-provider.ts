import { db } from "@/db";
import {
  companies,
  notifications,
  paymentWebhookEvents,
  saasCouponRedemptions,
  saasCoupons,
  saasPlans,
  subscriptionInvoices,
  subscriptions,
  users,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { and, desc, eq } from "drizzle-orm";
import { assertServerOnly } from "@/lib/server-guard";
import { SaasCouponService } from "./coupon-service";
import { DEFAULT_SAAS_PLANS } from "./plans-seed";

assertServerOnly("O provedor de pagamentos SaaS (Mercado Pago)");

export type InternalPaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "REFUNDED"
  | "CHARGED_BACK"
  | "EXPIRED";

export class MercadoPagoStatusMapper {
  static toInternal(mpStatus: string): InternalPaymentStatus {
    switch (mpStatus?.toLowerCase()) {
      case "approved":
        return "APPROVED";
      case "in_process":
      case "in_mediation":
        return "PROCESSING";
      case "pending":
      case "authorized":
        return "PENDING";
      case "rejected":
        return "REJECTED";
      case "cancelled":
        return "CANCELLED";
      case "refunded":
        return "REFUNDED";
      case "charged_back":
        return "CHARGED_BACK";
      default:
        return "PENDING";
    }
  }

  static toInvoiceStatus(internal: InternalPaymentStatus): "paid" | "pending" | "failed" | "cancelled" | "refunded" | "expired" {
    switch (internal) {
      case "APPROVED":
        return "paid";
      case "PROCESSING":
      case "PENDING":
        return "pending";
      case "REJECTED":
        return "failed";
      case "CANCELLED":
        return "cancelled";
      case "REFUNDED":
      case "CHARGED_BACK":
        return "refunded";
      case "EXPIRED":
        return "expired";
      default:
        return "pending";
    }
  }
}

export interface CreatePixPaymentInput {
  companyId: string;
  planSlug: string;
  billingInterval: "monthly" | "yearly";
  couponCode?: string;
  payerEmail: string;
  payerName: string;
}

export interface PixPaymentResult {
  invoiceId: string;
  paymentId: string;
  subtotal: number;
  discount: number;
  amount: number;
  qrCode: string;
  qrCodeBase64: string;
  copiaECola: string;
  expiresAt: string;
  status: "pending" | "paid";
  isFreeWithCoupon?: boolean;
  isSimulated: boolean;
}

export interface CreateCardPaymentInput {
  companyId: string;
  planSlug: string;
  billingInterval: "monthly" | "yearly";
  cardToken?: string;
  paymentMethodId?: string;
  installments?: number;
  couponCode?: string;
  payerEmail: string;
  payerName: string;
}

export interface CardPaymentResult {
  invoiceId: string;
  paymentId: string;
  subtotal: number;
  discount: number;
  amount: number;
  status: "approved" | "rejected" | "in_process" | "pending";
  statusDetail?: string;
  isFreeWithCoupon?: boolean;
  isSimulated: boolean;
}

export interface PaymentProvider {
  createPixPayment(input: CreatePixPaymentInput, executor?: any): Promise<PixPaymentResult>;
  createCardPayment(input: CreateCardPaymentInput, executor?: any): Promise<CardPaymentResult>;
  cancelSubscription(companyId: string, cancelImmediately?: boolean, executor?: any): Promise<void>;
  reactivateSubscription(companyId: string, executor?: any): Promise<void>;
  getPaymentStatus(paymentId: string, executor?: any): Promise<{ status: string; paid: boolean }>;
}

export class SaasPaymentProvider implements PaymentProvider {
  private getMpAccessToken(): string | null {
    return process.env.MERCADO_PAGO_ACCESS_TOKEN || null;
  }

  private async getPlanDetails(planSlug: string, executor: any = db) {
    const [dbPlan] = await executor
      .select()
      .from(saasPlans)
      .where(eq(saasPlans.slug, planSlug))
      .limit(1);

    if (dbPlan) {
      return {
        id: dbPlan.id,
        slug: dbPlan.slug,
        name: dbPlan.name,
        description: dbPlan.description,
        monthlyPrice: Number(dbPlan.monthlyPrice),
        annualPrice: Number(dbPlan.annualPrice),
        employeeLimit: dbPlan.employeeLimit,
      };
    }

    const fallback = DEFAULT_SAAS_PLANS.find((p) => p.slug === planSlug);
    if (fallback) {
      return {
        id: null,
        slug: fallback.slug,
        name: fallback.name,
        description: fallback.description,
        monthlyPrice: Number(fallback.monthlyPrice),
        annualPrice: Number(fallback.annualPrice),
        employeeLimit: fallback.employeeLimit,
      };
    }

    throw new Error(`Plano '${planSlug}' não encontrado.`);
  }

  /**
   * Generates a transparent PIX payment for SaaS Subscription with optional Coupon.
   */
  async createPixPayment(input: CreatePixPaymentInput, executor: any = db): Promise<PixPaymentResult> {
    const plan = await this.getPlanDetails(input.planSlug, executor);
    const subtotal = input.billingInterval === "yearly" ? plan.annualPrice : plan.monthlyPrice;

    // Evaluate coupon if provided
    let discount = 0;
    let finalAmount = subtotal;
    let couponId: string | null = null;

    if (input.couponCode) {
      const couponValidation = await SaasCouponService.validateCoupon({
        code: input.couponCode,
        planSlug: input.planSlug,
        billingInterval: input.billingInterval,
        companyId: input.companyId,
        executor,
      });

      discount = couponValidation.discountAmount;
      finalAmount = couponValidation.finalPrice;
      couponId = couponValidation.coupon.id;
    }

    const invoiceId = crypto.randomUUID();
    const expiresAtDate = new Date(Date.now() + 30 * 60 * 1000); // 30 mins validity

    // Ensure company has a subscription record
    let [sub] = await executor
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, input.companyId))
      .limit(1);

    let subscriptionId = sub?.id;
    if (!sub) {
      subscriptionId = crypto.randomUUID();
      await executor.insert(subscriptions).values({
        id: subscriptionId,
        companyId: input.companyId,
        plan: input.planSlug,
        planId: plan.id,
        billingInterval: input.billingInterval,
        amount: finalAmount.toFixed(2),
        priceSnapshot: subtotal.toFixed(2),
        discountSnapshot: discount.toFixed(2),
        finalPriceSnapshot: finalAmount.toFixed(2),
        appliedCouponId: couponId,
        paymentMethod: "pix",
        status: "pending",
        trialEndsAt: new Date(),
      });
    }

    // 100% discount flow (R$ 0,00) -> Direct activation without Mercado Pago API call
    if (finalAmount === 0) {
      await this.activateCompanySubscription({
        companyId: input.companyId,
        planSlug: input.planSlug,
        billingInterval: input.billingInterval,
        amount: 0,
        subtotal,
        discount,
        paymentMethod: "pix",
        gatewayPaymentId: `free_coupon_${invoiceId}`,
        invoiceId,
        couponId: couponId ?? undefined,
        executor,
      });

      if (couponId) {
        await SaasCouponService.confirmCouponRedemption({
          couponId,
          companyId: input.companyId,
          invoiceId,
          executor,
        });
      }

      return {
        invoiceId,
        paymentId: `free_coupon_${invoiceId}`,
        subtotal,
        discount,
        amount: 0,
        qrCode: "",
        qrCodeBase64: "",
        copiaECola: "",
        expiresAt: expiresAtDate.toISOString(),
        status: "paid",
        isFreeWithCoupon: true,
        isSimulated: false,
      };
    }

    // Call Mercado Pago API if token is configured
    const token = this.getMpAccessToken();
    if (token && !token.startsWith("TEST-SIMULATED")) {
      try {
        const response = await fetch("https://api.mercadopago.com/v1/payments", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-Idempotency-Key": `pix_${invoiceId}`,
          },
          body: JSON.stringify({
            transaction_amount: finalAmount,
            description: `Reservei SaaS - Plano ${plan.name} (${input.billingInterval === "yearly" ? "Anual" : "Mensal"})`,
            payment_method_id: "pix",
            payer: {
              email: input.payerEmail,
              first_name: input.payerName.split(" ")[0] || "Cliente",
              last_name: input.payerName.split(" ").slice(1).join(" ") || "Reservei",
            },
            date_of_expiration: expiresAtDate.toISOString(),
            external_reference: JSON.stringify({
              companyId: input.companyId,
              planSlug: input.planSlug,
              billingInterval: input.billingInterval,
              invoiceId,
              couponId,
              type: "saas_subscription",
            }),
            notification_url: `${(process.env.APP_URL ?? "https://reservei.com.br").replace(/\/$/, "")}/api/webhooks/mercadopago`,
          }),
        });

        if (response.ok) {
          const mpData = await response.json();
          const poi = mpData.point_of_interaction?.transaction_data;
          const qrCode = poi?.qr_code || `00020126580014br.gov.bcb.pix0136${crypto.randomUUID()}520400005303986540${finalAmount.toFixed(2)}5802BR5913Reservei SaaS6009Sao Paulo62070503***6304`;
          const qrCodeBase64 = poi?.qr_code_base64 || "";
          const paymentId = String(mpData.id);

          await executor.insert(subscriptionInvoices).values({
            id: invoiceId,
            subscriptionId: subscriptionId!,
            companyId: input.companyId,
            planSlug: input.planSlug,
            billingInterval: input.billingInterval,
            subtotal: subtotal.toFixed(2),
            discount: discount.toFixed(2),
            total: finalAmount.toFixed(2),
            amount: finalAmount.toFixed(2),
            currency: "BRL",
            paymentMethod: "pix",
            status: "pending",
            dueAt: expiresAtDate,
            pixQrCode: qrCode,
            pixQrCodeBase64: qrCodeBase64,
            pixCopiaECola: qrCode,
            pixExpiresAt: expiresAtDate,
            mercadoPagoPaymentId: paymentId,
            gatewayStatus: mpData.status,
            gatewayStatusDetail: mpData.status_detail,
            metadata: { externalReference: { companyId: input.companyId, planSlug: input.planSlug, invoiceId, couponId } },
          });

          if (couponId) {
            await SaasCouponService.reserveCouponRedemption({
              couponId,
              companyId: input.companyId,
              subscriptionId,
              invoiceId,
              originalAmount: subtotal,
              discountAmount: discount,
              finalAmount,
              executor,
            });
          }

          return {
            invoiceId,
            paymentId,
            subtotal,
            discount,
            amount: finalAmount,
            qrCode,
            qrCodeBase64,
            copiaECola: qrCode,
            expiresAt: expiresAtDate.toISOString(),
            status: "pending",
            isSimulated: false,
          };
        }
      } catch (err) {
        console.warn("[SaasPaymentProvider] MercadoPago PIX request failed, falling back to sandbox simulation:", err);
      }
    }

    // Sandbox / Offline Simulation mode
    const simulatedPaymentId = `pix_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const simulatedQrCode = `00020126580014br.gov.bcb.pix0136${crypto.randomUUID()}520400005303986540${finalAmount.toFixed(2)}5802BR5913Reservei SaaS6009Sao Paulo62070503***6304`;

    await executor.insert(subscriptionInvoices).values({
      id: invoiceId,
      subscriptionId: subscriptionId!,
      companyId: input.companyId,
      planSlug: input.planSlug,
      billingInterval: input.billingInterval,
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      total: finalAmount.toFixed(2),
      amount: finalAmount.toFixed(2),
      currency: "BRL",
      paymentMethod: "pix",
      status: "pending",
      dueAt: expiresAtDate,
      pixQrCode: simulatedQrCode,
      pixQrCodeBase64: "",
      pixCopiaECola: simulatedQrCode,
      pixExpiresAt: expiresAtDate,
      mercadoPagoPaymentId: simulatedPaymentId,
      gatewayStatus: "pending",
      metadata: { isSimulated: true, couponId },
    });

    if (couponId) {
      await SaasCouponService.reserveCouponRedemption({
        couponId,
        companyId: input.companyId,
        subscriptionId,
        invoiceId,
        originalAmount: subtotal,
        discountAmount: discount,
        finalAmount,
        executor,
      });
    }

    return {
      invoiceId,
      paymentId: simulatedPaymentId,
      subtotal,
      discount,
      amount: finalAmount,
      qrCode: simulatedQrCode,
      qrCodeBase64: "",
      copiaECola: simulatedQrCode,
      expiresAt: expiresAtDate.toISOString(),
      status: "pending",
      isSimulated: true,
    };
  }

  /**
   * Processes transparent Credit Card payment via token.
   * Zero card number / CVV storage on backend.
   */
  async createCardPayment(input: CreateCardPaymentInput, executor: any = db): Promise<CardPaymentResult> {
    const plan = await this.getPlanDetails(input.planSlug, executor);
    const subtotal = input.billingInterval === "yearly" ? plan.annualPrice : plan.monthlyPrice;

    // Evaluate coupon if provided
    let discount = 0;
    let finalAmount = subtotal;
    let couponId: string | null = null;

    if (input.couponCode) {
      const couponValidation = await SaasCouponService.validateCoupon({
        code: input.couponCode,
        planSlug: input.planSlug,
        billingInterval: input.billingInterval,
        companyId: input.companyId,
        executor,
      });

      discount = couponValidation.discountAmount;
      finalAmount = couponValidation.finalPrice;
      couponId = couponValidation.coupon.id;
    }

    const token = this.getMpAccessToken();
    const invoiceId = crypto.randomUUID();

    // 100% discount flow (R$ 0,00)
    if (finalAmount === 0) {
      await this.activateCompanySubscription({
        companyId: input.companyId,
        planSlug: input.planSlug,
        billingInterval: input.billingInterval,
        amount: 0,
        subtotal,
        discount,
        paymentMethod: "card",
        gatewayPaymentId: `free_coupon_${invoiceId}`,
        invoiceId,
        couponId: couponId ?? undefined,
        executor,
      });

      if (couponId) {
        await SaasCouponService.confirmCouponRedemption({
          couponId,
          companyId: input.companyId,
          invoiceId,
          executor,
        });
      }

      return {
        invoiceId,
        paymentId: `free_coupon_${invoiceId}`,
        subtotal,
        discount,
        amount: 0,
        status: "approved",
        statusDetail: "accredited",
        isFreeWithCoupon: true,
        isSimulated: false,
      };
    }

    // Check for mock rejection card in testing (e.g. card token starts with 'reject')
    if (input.cardToken === "token_rejected" || input.cardToken?.includes("reject")) {
      const paymentId = `card_sim_rej_${Date.now()}`;
      return {
        invoiceId,
        paymentId,
        subtotal,
        discount,
        amount: finalAmount,
        status: "rejected",
        statusDetail: "cc_rejected_bad_filled_other",
        isSimulated: true,
      };
    }

    if (token && !token.startsWith("TEST-SIMULATED") && input.cardToken && !input.cardToken.startsWith("sim_token")) {
      try {
        const response = await fetch("https://api.mercadopago.com/v1/payments", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "X-Idempotency-Key": `card_${invoiceId}`,
          },
          body: JSON.stringify({
            transaction_amount: finalAmount,
            token: input.cardToken,
            description: `Reservei SaaS - Plano ${plan.name} (${input.billingInterval === "yearly" ? "Anual" : "Mensal"})`,
            installments: input.installments || 1,
            payment_method_id: input.paymentMethodId || "credit_card",
            payer: {
              email: input.payerEmail,
              first_name: input.payerName.split(" ")[0] || "Cliente",
              last_name: input.payerName.split(" ").slice(1).join(" ") || "Reservei",
            },
            external_reference: JSON.stringify({
              companyId: input.companyId,
              planSlug: input.planSlug,
              billingInterval: input.billingInterval,
              invoiceId,
              couponId,
              type: "saas_subscription",
            }),
            notification_url: `${(process.env.APP_URL ?? "https://reservei.com.br").replace(/\/$/, "")}/api/webhooks/mercadopago`,
          }),
        });

        if (response.ok) {
          const mpData = await response.json();
          const paymentId = String(mpData.id);
          const status = mpData.status as "approved" | "rejected" | "in_process" | "pending";

          if (status === "approved") {
            await this.activateCompanySubscription({
              companyId: input.companyId,
              planSlug: input.planSlug,
              billingInterval: input.billingInterval,
              amount: finalAmount,
              subtotal,
              discount,
              paymentMethod: "card",
              gatewayPaymentId: paymentId,
              invoiceId,
              couponId: couponId ?? undefined,
              executor,
            });

            if (couponId) {
              await SaasCouponService.confirmCouponRedemption({
                couponId,
                companyId: input.companyId,
                invoiceId,
                executor,
              });
            }
          }

          return {
            invoiceId,
            paymentId,
            subtotal,
            discount,
            amount: finalAmount,
            status,
            statusDetail: mpData.status_detail,
            isSimulated: false,
          };
        }
      } catch (err) {
        console.warn("[SaasPaymentProvider] MercadoPago Card request failed, falling back to sandbox simulation:", err);
      }
    }

    // Sandbox / offline simulator: approve payment
    const simulatedPaymentId = `card_sim_${Date.now()}`;
    await this.activateCompanySubscription({
      companyId: input.companyId,
      planSlug: input.planSlug,
      billingInterval: input.billingInterval,
      amount: finalAmount,
      subtotal,
      discount,
      paymentMethod: "card",
      gatewayPaymentId: simulatedPaymentId,
      invoiceId,
      couponId: couponId ?? undefined,
      executor,
    });

    if (couponId) {
      await SaasCouponService.confirmCouponRedemption({
        couponId,
        companyId: input.companyId,
        invoiceId,
        executor,
      });
    }

    return {
      invoiceId,
      paymentId: simulatedPaymentId,
      subtotal,
      discount,
      amount: finalAmount,
      status: "approved",
      statusDetail: "accredited",
      isSimulated: true,
    };
  }

  /**
   * Activates or updates a subscription and records the invoice as paid.
   */
  async activateCompanySubscription(params: {
    companyId: string;
    planSlug: string;
    billingInterval: "monthly" | "yearly";
    amount: number;
    subtotal?: number;
    discount?: number;
    paymentMethod: "pix" | "card" | "manual";
    gatewayPaymentId: string;
    invoiceId?: string;
    couponId?: string;
    executor?: any;
  }): Promise<void> {
    const executor = params.executor ?? db;
    const plan = await this.getPlanDetails(params.planSlug, executor);
    const now = new Date();
    const periodDays = params.billingInterval === "yearly" ? 365 : 30;
    const currentPeriodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);
    const subtotal = params.subtotal ?? (params.billingInterval === "yearly" ? plan.annualPrice : plan.monthlyPrice);
    const discount = params.discount ?? 0;

    const [existing] = await executor
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, params.companyId))
      .limit(1);

    let subscriptionId = existing?.id;

    if (existing) {
      await executor
        .update(subscriptions)
        .set({
          plan: params.planSlug,
          planId: plan.id,
          status: "active",
          billingInterval: params.billingInterval,
          amount: params.amount.toFixed(2),
          priceSnapshot: subtotal.toFixed(2),
          discountSnapshot: discount.toFixed(2),
          finalPriceSnapshot: params.amount.toFixed(2),
          appliedCouponId: params.couponId ?? existing.appliedCouponId ?? null,
          paymentMethod: params.paymentMethod,
          currentPeriodStart: now,
          currentPeriodEnd,
          nextPaymentAt: currentPeriodEnd,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          gatewayPaymentId: params.gatewayPaymentId,
          updatedAt: now,
        })
        .where(eq(subscriptions.companyId, params.companyId));
    } else {
      const newSubId = crypto.randomUUID();
      await executor.insert(subscriptions).values({
        id: newSubId,
        companyId: params.companyId,
        plan: params.planSlug,
        planId: plan.id,
        status: "active",
        billingInterval: params.billingInterval,
        amount: params.amount.toFixed(2),
        priceSnapshot: subtotal.toFixed(2),
        discountSnapshot: discount.toFixed(2),
        finalPriceSnapshot: params.amount.toFixed(2),
        appliedCouponId: params.couponId ?? null,
        paymentMethod: params.paymentMethod,
        trialEndsAt: now,
        currentPeriodStart: now,
        currentPeriodEnd,
        nextPaymentAt: currentPeriodEnd,
        cancelAtPeriodEnd: false,
        gatewayPaymentId: params.gatewayPaymentId,
      });
      subscriptionId = newSubId;
    }

    // Record invoice
    const invId = params.invoiceId ?? crypto.randomUUID();
    const [existingInvoice] = await executor
      .select()
      .from(subscriptionInvoices)
      .where(eq(subscriptionInvoices.mercadoPagoPaymentId, params.gatewayPaymentId))
      .limit(1);

    if (existingInvoice) {
      await executor
        .update(subscriptionInvoices)
        .set({
          status: "paid",
          paidAt: now,
          gatewayStatus: "approved",
          gatewayStatusDetail: "accredited",
          subtotal: subtotal.toFixed(2),
          discount: discount.toFixed(2),
          total: params.amount.toFixed(2),
          amount: params.amount.toFixed(2),
        })
        .where(eq(subscriptionInvoices.id, existingInvoice.id));
    } else {
      await executor.insert(subscriptionInvoices).values({
        id: invId,
        subscriptionId: subscriptionId!,
        companyId: params.companyId,
        planSlug: params.planSlug,
        billingInterval: params.billingInterval,
        subtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        total: params.amount.toFixed(2),
        amount: params.amount.toFixed(2),
        currency: "BRL",
        paymentMethod: params.paymentMethod,
        status: "paid",
        paidAt: now,
        gatewayStatus: "approved",
        gatewayStatusDetail: "accredited",
        mercadoPagoPaymentId: params.gatewayPaymentId,
      });
    }

    // Audit and owner notifications
    const [owner] = await executor
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.companyId, params.companyId), eq(users.role, "owner")))
      .limit(1);

    if (owner) {
      await executor.insert(notifications).values({
        id: crypto.randomUUID(),
        companyId: params.companyId,
        userId: owner.id,
        type: "subscription_active",
        title: "Assinatura Reservei Ativada!",
        body: `Seu pagamento de R$ ${params.amount.toFixed(2)} foi confirmado. O plano ${plan.name} está ativo com todos os recursos e limite de ${plan.employeeLimit} funcionários.`,
        createdAt: now,
      });
    }

    await recordAudit(
      {
        companyId: params.companyId,
        action: "subscription.paid",
        entity: "subscription",
        metadata: {
          paymentId: params.gatewayPaymentId,
          planSlug: params.planSlug,
          amount: params.amount,
          billingInterval: params.billingInterval,
          couponId: params.couponId,
        },
      },
      executor
    );
  }

  /**
   * Cancels subscription at period end or immediately.
   */
  async cancelSubscription(companyId: string, cancelImmediately: boolean = false, executor: any = db): Promise<void> {
    const [sub] = await executor
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, companyId))
      .limit(1);

    if (!sub) throw new Error("Assinatura não encontrada.");

    const now = new Date();
    await executor
      .update(subscriptions)
      .set({
        status: cancelImmediately ? "cancelled" : sub.status,
        cancelAtPeriodEnd: true,
        cancelledAt: now,
        updatedAt: now,
      })
      .where(eq(subscriptions.companyId, companyId));

    await recordAudit(
      {
        companyId,
        action: "subscription.cancelled",
        entity: "subscription",
        metadata: { cancelImmediately },
      },
      executor
    );
  }

  /**
   * Reactivates a cancelled or expiring subscription.
   */
  async reactivateSubscription(companyId: string, executor: any = db): Promise<void> {
    const [sub] = await executor
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, companyId))
      .limit(1);

    if (!sub) throw new Error("Assinatura não encontrada.");

    await executor
      .update(subscriptions)
      .set({
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.companyId, companyId));

    await recordAudit(
      {
        companyId,
        action: "subscription.reactivated",
        entity: "subscription",
        metadata: { previousStatus: sub.status },
      },
      executor
    );
  }

  /**
   * Inquires payment status from local DB or Mercado Pago.
   */
  async getPaymentStatus(paymentId: string, executor: any = db): Promise<{ status: string; paid: boolean }> {
    const [inv] = await executor
      .select()
      .from(subscriptionInvoices)
      .where(eq(subscriptionInvoices.mercadoPagoPaymentId, paymentId))
      .limit(1);

    if (inv) {
      return {
        status: inv.status,
        paid: inv.status === "paid",
      };
    }

    return { status: "unknown", paid: false };
  }
}

export const saasPaymentProvider = new SaasPaymentProvider();
