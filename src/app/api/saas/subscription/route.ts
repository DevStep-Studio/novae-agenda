import { db } from "@/db";
import { saasPlans, subscriptionInvoices, subscriptions } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { PlanLimitService } from "@/lib/saas/plan-limits";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireRole("owner");
  if (gate.response) return gate.response;
  const { auth } = gate;

  try {
    const usage = await PlanLimitService.getUsageInfo(auth.user.companyId);

    const [rawSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, auth.user.companyId))
      .limit(1);

    const invoices = await db
      .select()
      .from(subscriptionInvoices)
      .where(eq(subscriptionInvoices.companyId, auth.user.companyId))
      .orderBy(desc(subscriptionInvoices.createdAt))
      .limit(30);

    return Response.json({
      data: {
        subscription: {
          id: rawSub?.id ?? null,
          companyId: auth.user.companyId,
          planSlug: usage.planSlug,
          planName: usage.planName,
          status: usage.subscriptionStatus,
          isEffectiveActive: usage.isEffectiveActive,
          billingInterval: usage.billingInterval,
          amount: usage.billingInterval === "yearly" ? usage.annualPrice : usage.monthlyPrice,
          paymentMethod: rawSub?.paymentMethod ?? "pix",
          currentPeriodStart: rawSub?.currentPeriodStart?.toISOString() ?? null,
          currentPeriodEnd: rawSub?.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: rawSub?.cancelAtPeriodEnd ?? false,
          cancelledAt: rawSub?.cancelledAt?.toISOString() ?? null,
          trialEndsAt: rawSub?.trialEndsAt?.toISOString() ?? null,
        },
        usage: {
          employeeLimit: usage.employeeLimit,
          activeEmployeesCount: usage.activeEmployeesCount,
          remainingSeats: usage.remainingSeats,
          isLimitReached: usage.isLimitReached,
          isExceeded: usage.isExceeded,
          canAddEmployee: usage.canAddEmployee,
          percentage: Math.min(100, Math.round((usage.activeEmployeesCount / usage.employeeLimit) * 100)),
        },
        invoices: invoices.map((inv) => ({
          id: inv.id,
          planSlug: inv.planSlug,
          billingInterval: inv.billingInterval,
          amount: Number(inv.amount),
          paymentMethod: inv.paymentMethod,
          status: inv.status,
          dueAt: inv.dueAt?.toISOString() ?? null,
          paidAt: inv.paidAt?.toISOString() ?? null,
          pixQrCode: inv.pixQrCode,
          pixCopiaECola: inv.pixCopiaECola,
          pixExpiresAt: inv.pixExpiresAt?.toISOString() ?? null,
          createdAt: inv.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("[SaaS Subscription API] Error fetching subscription details:", error);
    return Response.json({ error: "Erro ao buscar detalhes da assinatura." }, { status: 500 });
  }
}
