import { db } from "@/db";
import { saasCoupons } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface SaasCouponSeedDefinition {
  code: string;
  name: string;
  description: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: string;
  maxDiscountAmount?: string;
  appliesTo: "ALL_PLANS" | "SPECIFIC_PLANS";
  durationType: "ONCE" | "LIMITED_CYCLES" | "FOREVER";
  durationCycles?: number;
  maxRedemptionsPerBusiness: number;
  isActive: boolean;
}

export const DEFAULT_SAAS_COUPONS: SaasCouponSeedDefinition[] = [
  {
    code: "RESERVEI10",
    name: "Reservei 10% OFF",
    description: "10% de desconto no primeiro pagamento da assinatura.",
    discountType: "PERCENTAGE",
    discountValue: "10.00",
    appliesTo: "ALL_PLANS",
    durationType: "ONCE",
    durationCycles: 1,
    maxRedemptionsPerBusiness: 1,
    isActive: true,
  },
  {
    code: "BEMVINDO20",
    name: "Boas-vindas 20% OFF",
    description: "20% de desconto para novos estabelecimentos no primeiro ciclo.",
    discountType: "PERCENTAGE",
    discountValue: "20.00",
    appliesTo: "ALL_PLANS",
    durationType: "ONCE",
    durationCycles: 1,
    maxRedemptionsPerBusiness: 1,
    isActive: true,
  },
  {
    code: "3MESES",
    name: "Trimestre Promocional",
    description: "10% de desconto recorrente durante os 3 primeiros ciclos.",
    discountType: "PERCENTAGE",
    discountValue: "10.00",
    appliesTo: "ALL_PLANS",
    durationType: "LIMITED_CYCLES",
    durationCycles: 3,
    maxRedemptionsPerBusiness: 1,
    isActive: true,
  },
];

/**
 * Idempotently seeds demo coupons into the database.
 */
export async function seedSaasCoupons(executor: any = db) {
  for (const item of DEFAULT_SAAS_COUPONS) {
    const [existing] = await executor
      .select()
      .from(saasCoupons)
      .where(eq(saasCoupons.code, item.code))
      .limit(1);

    if (!existing) {
      await executor.insert(saasCoupons).values({
        id: crypto.randomUUID(),
        code: item.code,
        name: item.name,
        description: item.description,
        discountType: item.discountType,
        discountValue: item.discountValue,
        maxDiscountAmount: item.maxDiscountAmount ?? null,
        appliesTo: item.appliesTo,
        durationType: item.durationType,
        durationCycles: item.durationCycles ?? 1,
        maxRedemptionsPerBusiness: item.maxRedemptionsPerBusiness,
        isActive: item.isActive,
      });
    } else {
      await executor
        .update(saasCoupons)
        .set({
          name: item.name,
          description: item.description,
          discountType: item.discountType,
          discountValue: item.discountValue,
          maxDiscountAmount: item.maxDiscountAmount ?? null,
          appliesTo: item.appliesTo,
          durationType: item.durationType,
          durationCycles: item.durationCycles ?? 1,
          maxRedemptionsPerBusiness: item.maxRedemptionsPerBusiness,
          isActive: item.isActive,
        })
        .where(eq(saasCoupons.id, existing.id));
    }
  }
}
