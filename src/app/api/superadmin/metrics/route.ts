import { db } from "@/db";
import { adminAuditLogs, companies, saasCouponRedemptions, saasCoupons, subscriptions, users } from "@/db/schema";
import { requireSuperadmin } from "@/lib/auth";
import { and, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Companies stats
    const [totalOwnersRes, activeOwnersRes, newThisMonthRes] = await Promise.all([
      db.select({ count: count() }).from(companies),
      db.select({ count: count() }).from(companies).where(isNull(companies.deletedAt)),
      db.select({ count: count() }).from(companies).where(gte(companies.createdAt, startOfMonth)),
    ]);

    const totalOwners = totalOwnersRes[0]?.count ?? 0;
    const activeOwners = activeOwnersRes[0]?.count ?? 0;
    const newOwnersThisMonth = newThisMonthRes[0]?.count ?? 0;

    // 2. Subscriptions stats
    const activeSubs = await db
      .select({
        status: subscriptions.status,
        billingInterval: subscriptions.billingInterval,
        amount: subscriptions.amount,
        finalPriceSnapshot: subscriptions.finalPriceSnapshot,
      })
      .from(subscriptions);

    let mrr = 0;
    let activeSubscribers = 0;
    let trialingCount = 0;
    let churnedCount = 0;

    for (const sub of activeSubs) {
      if (sub.status === "active") {
        activeSubscribers++;
        const price = Number(sub.finalPriceSnapshot || sub.amount || 0);
        if (sub.billingInterval === "yearly") {
          mrr += price / 12;
        } else {
          mrr += price;
        }
      } else if (sub.status === "trialing") {
        trialingCount++;
      } else if (["cancelled", "expired", "past_due"].includes(sub.status)) {
        churnedCount++;
      }
    }

    const churnRate = (activeSubscribers + churnedCount) > 0
      ? Number(((churnedCount / (activeSubscribers + churnedCount)) * 100).toFixed(1))
      : 0;

    // 3. Top influencer coupons
    const topCoupons = await db
      .select({
        couponId: saasCoupons.id,
        code: saasCoupons.code,
        name: saasCoupons.name,
        influencerName: saasCoupons.influencerName,
        totalUses: count(saasCouponRedemptions.id),
        convertedUses: sql<number>`sum(case when ${saasCouponRedemptions.isConverted} = true or ${saasCouponRedemptions.status} = 'confirmed' then 1 else 0 end)`,
      })
      .from(saasCoupons)
      .leftJoin(saasCouponRedemptions, eq(saasCoupons.id, saasCouponRedemptions.couponId))
      .groupBy(saasCoupons.id, saasCoupons.code, saasCoupons.name, saasCoupons.influencerName)
      .orderBy(desc(count(saasCouponRedemptions.id)))
      .limit(5);

    // 4. Recent audit activity
    const recentAudit = await db
      .select({
        id: adminAuditLogs.id,
        action: adminAuditLogs.action,
        entity: adminAuditLogs.entity,
        entityName: adminAuditLogs.entityName,
        adminEmail: adminAuditLogs.adminEmail,
        createdAt: adminAuditLogs.createdAt,
      })
      .from(adminAuditLogs)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(5);

    return Response.json({
      data: {
        totalOwners,
        activeOwners,
        newOwnersThisMonth,
        mrr: Number(mrr.toFixed(2)),
        activeSubscribers,
        trialingCount,
        churnedCount,
        churnRate,
        topCoupons: topCoupons.map((c) => ({
          ...c,
          convertedUses: Number(c.convertedUses || 0),
          conversionRate: Number(c.totalUses) > 0
            ? Number(((Number(c.convertedUses || 0) / Number(c.totalUses)) * 100).toFixed(1))
            : 0,
        })),
        recentAudit,
      },
    });
  } catch (error) {
    console.error("[Superadmin Metrics API] Error calculating metrics:", error);
    return Response.json({ error: "Erro ao carregar métricas da plataforma." }, { status: 500 });
  }
}
