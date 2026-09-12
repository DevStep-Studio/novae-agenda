import { db } from "@/db";
import { companies, saasCouponRedemptions, saasCoupons } from "@/db/schema";
import { requireSuperadmin } from "@/lib/auth";
import { and, count, desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const coupons = await db
      .select()
      .from(saasCoupons)
      .orderBy(desc(saasCoupons.createdAt));

    const redemptions = await db
      .select({
        id: saasCouponRedemptions.id,
        couponId: saasCouponRedemptions.couponId,
        companyId: saasCouponRedemptions.companyId,
        companyName: companies.name,
        originalAmount: saasCouponRedemptions.originalAmount,
        discountAmount: saasCouponRedemptions.discountAmount,
        finalAmount: saasCouponRedemptions.finalAmount,
        status: saasCouponRedemptions.status,
        redeemedAt: saasCouponRedemptions.redeemedAt,
        createdAt: saasCouponRedemptions.createdAt,
      })
      .from(saasCouponRedemptions)
      .innerJoin(companies, eq(saasCouponRedemptions.companyId, companies.id))
      .orderBy(desc(saasCouponRedemptions.createdAt))
      .limit(100);

    const [globalAgg] = await db
      .select({
        totalRedemptions: count(),
        totalDiscountGiven: sql<string>`coalesce(sum(case when status = 'confirmed' then discount_amount else 0 end), 0)`,
        totalRevenueGenerated: sql<string>`coalesce(sum(case when status = 'confirmed' then final_amount else 0 end), 0)`,
      })
      .from(saasCouponRedemptions);

    return Response.json({
      data: {
        summary: {
          totalCoupons: coupons.length,
          activeCoupons: coupons.filter((c) => c.isActive).length,
          totalConfirmedRedemptions: Number(globalAgg?.totalRedemptions ?? 0),
          totalDiscountGiven: Number(globalAgg?.totalDiscountGiven ?? 0),
          totalRevenueGenerated: Number(globalAgg?.totalRevenueGenerated ?? 0),
        },
        recentRedemptions: redemptions.map((r) => ({
          id: r.id,
          couponId: r.couponId,
          companyId: r.companyId,
          companyName: r.companyName,
          originalAmount: Number(r.originalAmount),
          discountAmount: Number(r.discountAmount),
          finalAmount: Number(r.finalAmount),
          status: r.status,
          redeemedAt: r.redeemedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("[Superadmin Coupon Stats API] Error:", error);
    return Response.json({ error: "Erro ao gerar relatório de cupons." }, { status: 500 });
  }
}
