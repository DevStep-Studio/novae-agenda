import { db } from "@/db";
import { saasPlans, subscriptions } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { PlanLimitService } from "@/lib/saas/plan-limits";
import { DEFAULT_SAAS_PLANS } from "@/lib/saas/plans-seed";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const changePlanSchema = z.object({
  targetPlanSlug: z.string().min(1, "Selecione o plano de destino."),
  billingInterval: z.enum(["monthly", "yearly"]).optional().default("monthly"),
  confirmDowngradeWithExcess: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const gate = await requireRole("owner");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const body = await request.json().catch(() => null);
  const parsed = changePlanSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { targetPlanSlug, billingInterval, confirmDowngradeWithExcess } = parsed.data;

  try {
    const evalResult = await PlanLimitService.evaluatePlanChange(auth.user.companyId, targetPlanSlug);

    if (evalResult.willExceed && !confirmDowngradeWithExcess) {
      return Response.json(
        {
          requiresConfirmation: true,
          message: `Seu negócio possui ${evalResult.currentUsage} funcionários ativos. O novo plano permite até ${evalResult.targetLimit}. Você poderá concluir a alteração, mas precisará regularizar ou não conseguirá adicionar novos funcionários. Deseja prosseguir?`,
          currentUsage: evalResult.currentUsage,
          targetLimit: evalResult.targetLimit,
          excessCount: evalResult.excessCount,
        },
        { status: 200 }
      );
    }

    // Find target plan
    let [targetDbPlan] = await db
      .select()
      .from(saasPlans)
      .where(eq(saasPlans.slug, targetPlanSlug))
      .limit(1);

    const price = targetDbPlan
      ? (billingInterval === "yearly" ? targetDbPlan.annualPrice : targetDbPlan.monthlyPrice)
      : (billingInterval === "yearly"
          ? DEFAULT_SAAS_PLANS.find((p) => p.slug === targetPlanSlug)?.annualPrice ?? "499.00"
          : DEFAULT_SAAS_PLANS.find((p) => p.slug === targetPlanSlug)?.monthlyPrice ?? "49.90");

    const [existingSub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, auth.user.companyId))
      .limit(1);

    const now = new Date();
    if (existingSub) {
      await db
        .update(subscriptions)
        .set({
          plan: targetPlanSlug,
          planId: targetDbPlan?.id ?? null,
          billingInterval,
          amount: price,
          updatedAt: now,
        })
        .where(eq(subscriptions.companyId, auth.user.companyId));
    } else {
      await db.insert(subscriptions).values({
        id: crypto.randomUUID(),
        companyId: auth.user.companyId,
        plan: targetPlanSlug,
        planId: targetDbPlan?.id ?? null,
        status: "active",
        billingInterval,
        amount: price,
        trialEndsAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });
    }

    const updatedUsage = await PlanLimitService.getUsageInfo(auth.user.companyId);

    return Response.json({
      data: {
        success: true,
        message: `Plano alterado para ${updatedUsage.planName} com sucesso.`,
        usage: updatedUsage,
      },
    });
  } catch (error: any) {
    console.error("[SaaS Change Plan API] Error changing plan:", error);
    return Response.json(
      { error: error.message || "Erro ao alterar plano de assinatura." },
      { status: 500 }
    );
  }
}
