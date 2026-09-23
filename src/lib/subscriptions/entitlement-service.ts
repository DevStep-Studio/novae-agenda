import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, subscriptions, subscriptionInvoices } from "@/db/schema";
import { PLANS, type PlanKey, type SubscriptionStatus } from "@/lib/subscriptions";

export type SubscriptionGateway = "mercadopago" | "apple" | "google_play" | "admin_grant" | "manual";

export interface CompanyEntitlement {
  companyId: string;
  hasActiveAccess: boolean;
  planKey: string;
  planName: string;
  status: SubscriptionStatus;
  gateway: SubscriptionGateway;
  origin: string;
  employeeLimit: number;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  isTrial: boolean;
  canAddEmployees: (currentCount: number) => boolean;
  features: string[];
}

export class SubscriptionEntitlementService {
  /**
   * Obtém a governança e status oficial de entitlement da empresa no SaaS Reservei.
   */
  public static async getCompanyEntitlement(companyId: string): Promise<CompanyEntitlement> {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, companyId))
      .limit(1);

    if (!sub) {
      // Se não houver registro de assinatura, retorna fallback com limites padrão
      return {
        companyId,
        hasActiveAccess: false,
        planKey: "trial",
        planName: "Teste Expirado",
        status: "expired",
        gateway: "manual",
        origin: "none",
        employeeLimit: 1,
        trialEndsAt: null,
        currentPeriodEnd: null,
        isTrial: false,
        canAddEmployees: (count) => count < 1,
        features: [],
      };
    }

    const planConfig = PLANS[sub.plan] || PLANS.essencial;
    const now = new Date();

    const isTrial = sub.status === "trialing";
    const trialValid = isTrial && sub.trialEndsAt && sub.trialEndsAt > now;
    const activeValid = sub.status === "active";
    const periodValid = sub.currentPeriodEnd ? sub.currentPeriodEnd > now : true;

    const hasActiveAccess = Boolean(activeValid || trialValid || sub.gateway === "admin_grant");
    const employeeLimit = planConfig.employeeLimit || 5;

    return {
      companyId,
      hasActiveAccess,
      planKey: sub.plan,
      planName: planConfig.name,
      status: sub.status as SubscriptionStatus,
      gateway: (sub.gateway as SubscriptionGateway) || "mercadopago",
      origin: sub.origin || "checkout",
      employeeLimit,
      trialEndsAt: sub.trialEndsAt,
      currentPeriodEnd: sub.currentPeriodEnd,
      isTrial,
      canAddEmployees: (currentCount: number) => currentCount < employeeLimit,
      features: planConfig.features || [],
    };
  }

  /**
   * Valida e aplica uma transação originada na Apple App Store (StoreKit 2 / JWS)
   */
  public static async applyAppleSubscription(params: {
    companyId: string;
    productId: string;
    transactionId: string;
    originalTransactionId: string;
    expiresDate?: Date | null;
    environment?: string;
  }) {
    // Mapeia Product ID da Apple para o PlanKey interno do Reservei
    const planKey = this.mapStoreProductToPlan(params.productId);
    const expiresAt = params.expiresDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [existing] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, params.companyId))
      .limit(1);

    if (existing) {
      await db
        .update(subscriptions)
        .set({
          plan: planKey,
          status: "active",
          gateway: "apple",
          origin: "apple_iap",
          gatewaySubscriptionId: params.originalTransactionId,
          gatewayPaymentId: params.transactionId,
          currentPeriodStart: new Date(),
          currentPeriodEnd: expiresAt,
          nextPaymentAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, existing.id));
    } else {
      await db.insert(subscriptions).values({
        id: crypto.randomUUID(),
        companyId: params.companyId,
        plan: planKey,
        status: "active",
        gateway: "apple",
        origin: "apple_iap",
        gatewaySubscriptionId: params.originalTransactionId,
        gatewayPaymentId: params.transactionId,
        trialEndsAt: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: expiresAt,
        nextPaymentAt: expiresAt,
      });
    }

    return this.getCompanyEntitlement(params.companyId);
  }

  /**
   * Valida e aplica uma assinatura originada na Google Play Store (Play Billing)
   */
  public static async applyGoogleSubscription(params: {
    companyId: string;
    productId: string;
    purchaseToken: string;
    orderId: string;
    expiryTimeMillis?: number | null;
  }) {
    const planKey = this.mapStoreProductToPlan(params.productId);
    const expiresAt = params.expiryTimeMillis
      ? new Date(params.expiryTimeMillis)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [existing] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, params.companyId))
      .limit(1);

    if (existing) {
      await db
        .update(subscriptions)
        .set({
          plan: planKey,
          status: "active",
          gateway: "google_play",
          origin: "google_play_billing",
          gatewaySubscriptionId: params.purchaseToken,
          gatewayPaymentId: params.orderId,
          currentPeriodStart: new Date(),
          currentPeriodEnd: expiresAt,
          nextPaymentAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, existing.id));
    } else {
      await db.insert(subscriptions).values({
        id: crypto.randomUUID(),
        companyId: params.companyId,
        plan: planKey,
        status: "active",
        gateway: "google_play",
        origin: "google_play_billing",
        gatewaySubscriptionId: params.purchaseToken,
        gatewayPaymentId: params.orderId,
        trialEndsAt: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: expiresAt,
        nextPaymentAt: expiresAt,
      });
    }

    return this.getCompanyEntitlement(params.companyId);
  }

  /**
   * Processa eventos recebidos via App Store Server Notifications V2
   */
  public static async handleAppleNotificationV2(notificationType: string, transactionInfo: any) {
    if (!transactionInfo?.originalTransactionId) return;

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.gatewaySubscriptionId, transactionInfo.originalTransactionId))
      .limit(1);

    if (!sub) return;

    switch (notificationType) {
      case "DID_RENEW":
      case "SUBSCRIBED":
        await db
          .update(subscriptions)
          .set({
            status: "active",
            currentPeriodEnd: transactionInfo.expiresDate ? new Date(transactionInfo.expiresDate) : null,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, sub.id));
        break;

      case "EXPIRED":
      case "DID_FAIL_TO_RENEW":
        await db
          .update(subscriptions)
          .set({
            status: "past_due",
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, sub.id));
        break;

      case "REVOKE":
      case "REFUND":
        await db
          .update(subscriptions)
          .set({
            status: "cancelled",
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, sub.id));
        break;
    }
  }

  private static mapStoreProductToPlan(productId: string): PlanKey {
    const cleanId = productId.toLowerCase();
    if (cleanId.includes("equipe") || cleanId.includes("team") || cleanId.includes("business")) {
      return "equipe";
    }
    if (cleanId.includes("profissional") || cleanId.includes("pro")) {
      return "profissional";
    }
    return "essencial";
  }
}
