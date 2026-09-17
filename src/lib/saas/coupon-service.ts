import { db } from "@/db";
import { saasCouponPlans, saasCouponRedemptions, saasCoupons, saasPlans } from "@/db/schema";
import { and, count, eq, sql } from "drizzle-orm";
import { DEFAULT_SAAS_PLANS } from "./plans-seed";

export interface SaasCouponValidationResult {
  valid: boolean;
  coupon: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    discountType: "PERCENTAGE" | "FIXED_AMOUNT";
    discountValue: number;
    maxDiscountAmount: number | null;
    durationType: "ONCE" | "LIMITED_CYCLES" | "FOREVER";
    durationCycles: number | null;
  };
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  isZeroTotal: boolean;
}

export class SaasCouponService {
  /**
   * Normalizes coupon code to avoid case sensitivity and spacing issues.
   * e.g. " reservei10  " => "RESERVEI10"
   */
  static normalizeCode(code: string): string {
    return (code || "").trim().toUpperCase();
  }

  /**
   * Calculates discount amount safely without floating-point inaccuracies.
   */
  static calculateDiscount(
    planPrice: number,
    coupon: {
      discountType: string;
      discountValue: string | number;
      maxDiscountAmount?: string | number | null;
    }
  ): {
    originalPrice: number;
    discountAmount: number;
    finalPrice: number;
    isZeroTotal: boolean;
  } {
    const rawPriceCents = Math.round(planPrice * 100);
    const discountVal = Number(coupon.discountValue);
    let discountCents = 0;

    if (coupon.discountType === "PERCENTAGE") {
      // Validate percentage boundaries (0 < percentage <= 100)
      const validPercentage = Math.max(0, Math.min(100, discountVal));
      discountCents = Math.round((rawPriceCents * validPercentage) / 100);

      if (coupon.maxDiscountAmount != null) {
        const maxCents = Math.round(Number(coupon.maxDiscountAmount) * 100);
        discountCents = Math.min(discountCents, maxCents);
      }
    } else {
      // FIXED_AMOUNT
      discountCents = Math.round(discountVal * 100);
    }

    // Never discount more than original price
    discountCents = Math.min(rawPriceCents, Math.max(0, discountCents));
    const finalPriceCents = Math.max(0, rawPriceCents - discountCents);

    const originalPrice = rawPriceCents / 100;
    const discountAmount = discountCents / 100;
    const finalPrice = finalPriceCents / 100;
    const isZeroTotal = finalPriceCents === 0;

    return {
      originalPrice,
      discountAmount,
      finalPrice,
      isZeroTotal,
    };
  }

  /**
   * Validates a coupon against business rules, dates, limits and plan eligibility.
   * Throws friendly domain error (with statusCode 422) if invalid.
   */
  static async validateCoupon(params: {
    code: string;
    planSlug: string;
    billingInterval: "monthly" | "yearly";
    companyId: string;
    executor?: any;
  }): Promise<SaasCouponValidationResult> {
    const executor = params.executor ?? db;
    const normalized = this.normalizeCode(params.code);

    if (!normalized) {
      const err: any = new Error("Código do cupom não informado.");
      err.statusCode = 422;
      throw err;
    }

    // 1. Fetch coupon
    const [coupon] = await executor
      .select()
      .from(saasCoupons)
      .where(eq(saasCoupons.code, normalized))
      .limit(1);

    if (!coupon || !coupon.isActive) {
      const err: any = new Error("Este cupom não é válido.");
      err.statusCode = 422;
      throw err;
    }

    // 2. Fetch plan price
    const [plan] = await executor
      .select()
      .from(saasPlans)
      .where(eq(saasPlans.slug, params.planSlug))
      .limit(1);

    let planPrice = 0;
    let planId = plan?.id ?? null;
    if (plan) {
      planPrice = Number(params.billingInterval === "yearly" ? plan.annualPrice : plan.monthlyPrice);
    } else {
      const fallback = DEFAULT_SAAS_PLANS.find((p) => p.slug === params.planSlug);
      if (fallback) {
        planPrice = Number(params.billingInterval === "yearly" ? fallback.annualPrice : fallback.monthlyPrice);
      } else {
        const err: any = new Error("Plano selecionado inválido.");
        err.statusCode = 422;
        throw err;
      }
    }

    const now = new Date();

    // 3. Date window check
    if (coupon.startsAt && coupon.startsAt > now) {
      const err: any = new Error("Este cupom ainda não está ativo.");
      err.statusCode = 422;
      throw err;
    }

    if (coupon.expiresAt && coupon.expiresAt < now) {
      const err: any = new Error("Este cupom expirou.");
      err.statusCode = 422;
      throw err;
    }

    // 4. Minimum plan amount check
    if (coupon.minimumPlanAmount != null && planPrice < Number(coupon.minimumPlanAmount)) {
      const err: any = new Error(
        `O valor do plano (R$ ${planPrice.toFixed(2)}) é inferior ao mínimo exigido por este cupom (R$ ${Number(coupon.minimumPlanAmount).toFixed(2)}).`
      );
      err.statusCode = 422;
      throw err;
    }

    // 5. Plan-specific restriction check
    if (coupon.appliesTo === "SPECIFIC_PLANS" && planId) {
      const [allowed] = await executor
        .select()
        .from(saasCouponPlans)
        .where(and(eq(saasCouponPlans.couponId, coupon.id), eq(saasCouponPlans.planId, planId)))
        .limit(1);

      if (!allowed) {
        const err: any = new Error("Este cupom não é válido para o plano selecionado.");
        err.statusCode = 422;
        throw err;
      }
    }

    // 6. Global redemption limit check
    if (coupon.maxRedemptions != null) {
      const [globalCount] = await executor
        .select({ count: count() })
        .from(saasCouponRedemptions)
        .where(
          and(
            eq(saasCouponRedemptions.couponId, coupon.id),
            eq(saasCouponRedemptions.status, "confirmed")
          )
        );

      if (Number(globalCount?.count ?? 0) >= coupon.maxRedemptions) {
        const err: any = new Error("Este cupom atingiu o limite máximo de utilizações.");
        err.statusCode = 422;
        throw err;
      }
    }

    // 7. Per-business redemption limit check
    if (coupon.maxRedemptionsPerBusiness != null) {
      const [bizCount] = await executor
        .select({ count: count() })
        .from(saasCouponRedemptions)
        .where(
          and(
            eq(saasCouponRedemptions.couponId, coupon.id),
            eq(saasCouponRedemptions.companyId, params.companyId),
            eq(saasCouponRedemptions.status, "confirmed")
          )
        );

      if (Number(bizCount?.count ?? 0) >= coupon.maxRedemptionsPerBusiness) {
        const err: any = new Error("Este cupom já foi utilizado por esta empresa.");
        err.statusCode = 422;
        throw err;
      }
    }

    // 8. Calculate final amounts
    const calculation = this.calculateDiscount(planPrice, {
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscountAmount: coupon.maxDiscountAmount,
    });

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        description: coupon.description,
        discountType: coupon.discountType as "PERCENTAGE" | "FIXED_AMOUNT",
        discountValue: Number(coupon.discountValue),
        maxDiscountAmount: coupon.maxDiscountAmount ? Number(coupon.maxDiscountAmount) : null,
        durationType: coupon.durationType as "ONCE" | "LIMITED_CYCLES" | "FOREVER",
        durationCycles: coupon.durationCycles,
      },
      originalPrice: calculation.originalPrice,
      discountAmount: calculation.discountAmount,
      finalPrice: calculation.finalPrice,
      isZeroTotal: calculation.isZeroTotal,
    };
  }

  /**
   * Reserves a pending coupon redemption during checkout.
   */
  static async reserveCouponRedemption(params: {
    couponId: string;
    companyId: string;
    subscriptionId?: string | null;
    invoiceId?: string | null;
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
    cycleNumber?: number;
    executor?: any;
  }): Promise<string> {
    const executor = params.executor ?? db;
    const redemptionId = crypto.randomUUID();

    await executor.insert(saasCouponRedemptions).values({
      id: redemptionId,
      couponId: params.couponId,
      companyId: params.companyId,
      subscriptionId: params.subscriptionId ?? null,
      invoiceId: params.invoiceId ?? null,
      originalAmount: params.originalAmount.toFixed(2),
      discountAmount: params.discountAmount.toFixed(2),
      finalAmount: params.finalAmount.toFixed(2),
      cycleNumber: params.cycleNumber ?? 1,
      status: "pending",
    });

    return redemptionId;
  }

  /**
   * Confirms a coupon redemption when payment is approved.
   */
  static async confirmCouponRedemption(params: {
    redemptionId?: string;
    invoiceId?: string;
    couponId?: string;
    companyId?: string;
    executor?: any;
  }): Promise<void> {
    const executor = params.executor ?? db;
    const now = new Date();

    if (params.redemptionId) {
      await executor
        .update(saasCouponRedemptions)
        .set({
          status: "confirmed",
          isConverted: true,
          convertedAt: now,
          redeemedAt: now,
          updatedAt: now,
        })
        .where(eq(saasCouponRedemptions.id, params.redemptionId));
      return;
    }

    if (params.invoiceId) {
      await executor
        .update(saasCouponRedemptions)
        .set({
          status: "confirmed",
          isConverted: true,
          convertedAt: now,
          redeemedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(saasCouponRedemptions.invoiceId, params.invoiceId),
            eq(saasCouponRedemptions.status, "pending")
          )
        );
      return;
    }

    if (params.couponId && params.companyId) {
      await executor
        .update(saasCouponRedemptions)
        .set({
          status: "confirmed",
          isConverted: true,
          convertedAt: now,
          redeemedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(saasCouponRedemptions.couponId, params.couponId),
            eq(saasCouponRedemptions.companyId, params.companyId),
            eq(saasCouponRedemptions.status, "pending")
          )
        );
    }
  }

  /**
   * Cancels a pending coupon redemption when payment fails or expires.
   */
  static async cancelCouponRedemption(params: {
    redemptionId?: string;
    invoiceId?: string;
    executor?: any;
  }): Promise<void> {
    const executor = params.executor ?? db;
    const now = new Date();

    if (params.redemptionId) {
      await executor
        .update(saasCouponRedemptions)
        .set({
          status: "cancelled",
          updatedAt: now,
        })
        .where(eq(saasCouponRedemptions.id, params.redemptionId));
    } else if (params.invoiceId) {
      await executor
        .update(saasCouponRedemptions)
        .set({
          status: "cancelled",
          updatedAt: now,
        })
        .where(
          and(
            eq(saasCouponRedemptions.invoiceId, params.invoiceId),
            eq(saasCouponRedemptions.status, "pending")
          )
        );
    }
  }
}
