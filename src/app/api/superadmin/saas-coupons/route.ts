import { db } from "@/db";
import { companies, saasCouponPlans, saasCouponRedemptions, saasCoupons, subscriptions } from "@/db/schema";
import { requireSuperadmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { SaasCouponService } from "@/lib/saas/coupon-service";
import { seedSaasCoupons } from "@/lib/saas/coupons-seed";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createCouponSchema = z.object({
  code: z.string().min(2, "Código do cupom deve ter pelo menos 2 caracteres.").max(50),
  name: z.string().min(2, "Nome do cupom é obrigatório.").max(100),
  description: z.string().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  discountValue: z.number().positive("O valor do desconto deve ser maior que zero."),
  maxDiscountAmount: z.number().positive().optional().nullable(),
  appliesTo: z.enum(["ALL_PLANS", "SPECIFIC_PLANS"]).default("ALL_PLANS"),
  planIds: z.array(z.string()).optional(),
  startsAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  maxRedemptions: z.number().int().positive().optional().nullable(),
  maxRedemptionsPerBusiness: z.number().int().positive().default(1),
  durationType: z.enum(["ONCE", "LIMITED_CYCLES", "FOREVER"]).default("ONCE"),
  durationCycles: z.number().int().positive().default(1),
  minimumPlanAmount: z.number().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
  influencerName: z.string().optional().nullable(),
  influencerContact: z.string().optional().nullable(),
  commissionType: z.enum(["NONE", "PERCENTAGE", "FIXED"]).default("NONE"),
  commissionValue: z.number().min(0).default(0),
});

export async function GET() {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    let list = await db
      .select()
      .from(saasCoupons)
      .orderBy(desc(saasCoupons.createdAt));

    if (list.length === 0 && process.env.NODE_ENV !== "production") {
      await seedSaasCoupons(db);
      list = await db
        .select()
        .from(saasCoupons)
        .orderBy(desc(saasCoupons.createdAt));
    }

    const couponIds = list.map((c) => c.id);
    const redemptions = couponIds.length
      ? await db
          .select({
            couponId: saasCouponRedemptions.couponId,
            totalRedemptions: count(),
            convertedUses: sql<number>`sum(case when ${saasCouponRedemptions.isConverted} = true or ${saasCouponRedemptions.status} = 'confirmed' then 1 else 0 end)`,
            cancelledUses: sql<number>`sum(case when ${saasCouponRedemptions.status} = 'cancelled' then 1 else 0 end)`,
            totalDiscount: sql<string>`sum(discount_amount)`,
            totalFinal: sql<string>`sum(final_amount)`,
          })
          .from(saasCouponRedemptions)
          .where(inArray(saasCouponRedemptions.couponId, couponIds))
          .groupBy(saasCouponRedemptions.couponId)
      : [];

    const statsMap = new Map(redemptions.map((r) => [r.couponId, r]));

    const data = list.map((c) => {
      const stats = statsMap.get(c.id);
      const totalRedemptions = Number(stats?.totalRedemptions ?? 0);
      const convertedUses = Number(stats?.convertedUses ?? 0);
      const cancelledUses = Number(stats?.cancelledUses ?? 0);
      const conversionRate = totalRedemptions > 0
        ? Number(((convertedUses / totalRedemptions) * 100).toFixed(1))
        : 0;

      return {
        id: c.id,
        code: c.code,
        name: c.name,
        description: c.description,
        discountType: c.discountType,
        discountValue: Number(c.discountValue),
        maxDiscountAmount: c.maxDiscountAmount ? Number(c.maxDiscountAmount) : null,
        appliesTo: c.appliesTo,
        startsAt: c.startsAt?.toISOString() ?? null,
        expiresAt: c.expiresAt?.toISOString() ?? null,
        maxRedemptions: c.maxRedemptions,
        maxRedemptionsPerBusiness: c.maxRedemptionsPerBusiness,
        durationType: c.durationType,
        durationCycles: c.durationCycles,
        minimumPlanAmount: c.minimumPlanAmount ? Number(c.minimumPlanAmount) : null,
        isActive: c.isActive,
        influencerName: c.influencerName,
        influencerContact: c.influencerContact,
        commissionType: c.commissionType,
        commissionValue: Number(c.commissionValue || 0),
        totalUses: totalRedemptions,
        convertedUses,
        cancelledUses,
        conversionRate,
        totalDiscountGiven: Number(stats?.totalDiscount ?? 0),
        totalRevenueGenerated: Number(stats?.totalFinal ?? 0),
        createdAt: c.createdAt.toISOString(),
      };
    });

    return Response.json({ data });
  } catch (error) {
    console.error("[Superadmin Coupons API] Error listing coupons:", error);
    return Response.json({ error: "Erro ao listar cupons SaaS." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  const body = await request.json().catch(() => null);
  const parsed = createCouponSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const {
    code,
    name,
    description,
    discountType,
    discountValue,
    maxDiscountAmount,
    appliesTo,
    planIds,
    startsAt,
    expiresAt,
    maxRedemptions,
    maxRedemptionsPerBusiness,
    durationType,
    durationCycles,
    minimumPlanAmount,
    isActive,
    influencerName,
    influencerContact,
    commissionType,
    commissionValue,
  } = parsed.data;

  const normalizedCode = SaasCouponService.normalizeCode(code);

  try {
    const [existing] = await db
      .select()
      .from(saasCoupons)
      .where(eq(saasCoupons.code, normalizedCode))
      .limit(1);

    if (existing) {
      return Response.json(
        { error: `Já existe um cupom cadastrado com o código ${normalizedCode}.` },
        { status: 409 }
      );
    }

    const couponId = crypto.randomUUID();
    await db.insert(saasCoupons).values({
      id: couponId,
      code: normalizedCode,
      name,
      description: description ?? null,
      discountType,
      discountValue: discountValue.toFixed(2),
      maxDiscountAmount: maxDiscountAmount ? maxDiscountAmount.toFixed(2) : null,
      appliesTo,
      startsAt: startsAt ? new Date(startsAt) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      maxRedemptions: maxRedemptions ?? null,
      maxRedemptionsPerBusiness,
      durationType,
      durationCycles: durationCycles ?? 1,
      minimumPlanAmount: minimumPlanAmount ? minimumPlanAmount.toFixed(2) : null,
      isActive,
      influencerName: influencerName ?? null,
      influencerContact: influencerContact ?? null,
      commissionType: commissionType ?? "NONE",
      commissionValue: commissionValue.toFixed(2),
    });

    if (appliesTo === "SPECIFIC_PLANS" && planIds && planIds.length > 0) {
      for (const planId of planIds) {
        await db.insert(saasCouponPlans).values({
          couponId,
          planId,
        });
      }
    }

    await logAdminAction({
      adminUserId: gate.auth.user.userId,
      adminEmail: gate.auth.user.email,
      action: "COUPON_CREATE",
      entity: "coupon",
      entityId: couponId,
      entityName: normalizedCode,
      reason: influencerName ? `Criado cupom para influenciador: ${influencerName}` : "Criação de cupom SaaS",
      afterState: {
        code: normalizedCode,
        name,
        discountType,
        discountValue,
        influencerName,
        commissionType,
        commissionValue,
      },
    });

    return Response.json(
      {
        data: {
          id: couponId,
          code: normalizedCode,
          name,
          message: "Cupom SaaS criado com sucesso.",
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[Superadmin Coupons API] Error creating coupon:", error);
    return Response.json(
      { error: error.message || "Erro ao criar cupom SaaS." },
      { status: 500 }
    );
  }
}
