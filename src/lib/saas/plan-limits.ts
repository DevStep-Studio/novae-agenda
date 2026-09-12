import { db } from "@/db";
import { companies, employees, saasPlans, subscriptions, users } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { DEFAULT_SAAS_PLANS } from "./plans-seed";

export interface PlanUsageInfo {
  companyId: string;
  planId: string | null;
  planSlug: string;
  planName: string;
  monthlyPrice: number;
  annualPrice: number;
  billingInterval: "monthly" | "yearly";
  subscriptionStatus: string;
  isEffectiveActive: boolean;
  employeeLimit: number;
  activeEmployeesCount: number;
  remainingSeats: number;
  isLimitReached: boolean;
  isExceeded: boolean;
  canAddEmployee: boolean;
}

export class PlanLimitService {
  /**
   * Counts active employees for a company.
   * Crucial rule: The owner is included in all plans and does NOT count as an employee seat.
   * Inactive employees (active = false) do NOT count.
   */
  static async getEmployeeUsage(companyId: string, executor: any = db): Promise<number> {
    const activeEmployees = await executor
      .select({
        id: employees.id,
        userId: employees.userId,
        name: employees.name,
      })
      .from(employees)
      .where(and(eq(employees.companyId, companyId), eq(employees.active, true)));

    if (activeEmployees.length === 0) return 0;

    // Identify userIds attached to these employees
    const userIds = activeEmployees
      .map((e: { userId: string | null }) => e.userId)
      .filter(Boolean) as string[];

    let ownerUserIds = new Set<string>();
    if (userIds.length > 0) {
      const ownerUsers = await executor
        .select({ id: users.id })
        .from(users)
        .where(and(inArray(users.id, userIds), eq(users.role, "owner")));
      ownerUserIds = new Set(ownerUsers.map((u: { id: string }) => u.id));
    }

    // Filter out owner user seats
    const countedEmployees = activeEmployees.filter(
      (e: { userId: string | null }) => !e.userId || !ownerUserIds.has(e.userId)
    );

    return countedEmployees.length;
  }

  /**
   * Retrieves complete plan usage and limits for a company.
   */
  static async getUsageInfo(companyId: string, executor: any = db): Promise<PlanUsageInfo> {
    const [sub] = await executor
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, companyId))
      .limit(1);

    let planSlug = "profissional";
    let planName = "Profissional";
    let monthlyPrice = 39.90;
    let annualPrice = 399.00;
    let employeeLimit = 5;
    let planId: string | null = null;
    let subscriptionStatus = sub?.status ?? "trialing";
    let billingInterval: "monthly" | "yearly" = (sub?.billingInterval as any) ?? "monthly";

    // If subscription exists with planId, query saasPlans
    if (sub?.planId) {
      const [matchedPlan] = await executor
        .select()
        .from(saasPlans)
        .where(eq(saasPlans.id, sub.planId))
        .limit(1);

      if (matchedPlan) {
        planId = matchedPlan.id;
        planSlug = matchedPlan.slug;
        planName = matchedPlan.name;
        monthlyPrice = Number(matchedPlan.monthlyPrice);
        annualPrice = Number(matchedPlan.annualPrice);
        employeeLimit = matchedPlan.employeeLimit;
      }
    } else if (sub?.plan) {
      // Look up by slug or fallback to default configuration
      const [matchedPlan] = await executor
        .select()
        .from(saasPlans)
        .where(eq(saasPlans.slug, sub.plan))
        .limit(1);

      if (matchedPlan) {
        planId = matchedPlan.id;
        planSlug = matchedPlan.slug;
        planName = matchedPlan.name;
        monthlyPrice = Number(matchedPlan.monthlyPrice);
        annualPrice = Number(matchedPlan.annualPrice);
        employeeLimit = matchedPlan.employeeLimit;
      } else {
        const defaultDef = DEFAULT_SAAS_PLANS.find((p) => p.slug === sub.plan);
        if (defaultDef) {
          planSlug = defaultDef.slug;
          planName = defaultDef.name;
          monthlyPrice = Number(defaultDef.monthlyPrice);
          annualPrice = Number(defaultDef.annualPrice);
          employeeLimit = defaultDef.employeeLimit;
        }
      }
    }

    // Calculate active employees count
    const activeEmployeesCount = await this.getEmployeeUsage(companyId, executor);
    const remainingSeats = Math.max(0, employeeLimit - activeEmployeesCount);
    const isLimitReached = activeEmployeesCount >= employeeLimit;
    const isExceeded = activeEmployeesCount > employeeLimit;
    const canAddEmployee = activeEmployeesCount < employeeLimit;

    const now = new Date();
    let isEffectiveActive = true;
    if (sub) {
      if (sub.status === "trialing" && sub.trialEndsAt && sub.trialEndsAt < now) {
        isEffectiveActive = false;
        subscriptionStatus = "expired";
      } else if (sub.status === "active" && sub.currentPeriodEnd && sub.currentPeriodEnd < now) {
        isEffectiveActive = false;
        subscriptionStatus = "past_due";
      } else if (["cancelled", "expired", "suspended"].includes(sub.status)) {
        isEffectiveActive = false;
      }
    }

    return {
      companyId,
      planId,
      planSlug,
      planName,
      monthlyPrice,
      annualPrice,
      billingInterval,
      subscriptionStatus,
      isEffectiveActive,
      employeeLimit,
      activeEmployeesCount,
      remainingSeats,
      isLimitReached,
      isExceeded,
      canAddEmployee,
    };
  }

  /**
   * Asserts whether an employee can be added or reactivated.
   * Throws friendly domain error if seat limit is reached.
   */
  static async assertCanAddEmployee(companyId: string, executor: any = db): Promise<void> {
    const usage = await this.getUsageInfo(companyId, executor);
    if (!usage.canAddEmployee) {
      const error: any = new Error(
        `Seu plano ${usage.planName} permite até ${usage.employeeLimit} funcionários. Você já utiliza ${usage.activeEmployeesCount} de ${usage.employeeLimit} vagas. Faça upgrade para adicionar mais membros da equipe.`
      );
      error.statusCode = 403;
      error.code = "PLAN_EMPLOYEE_LIMIT_EXCEEDED";
      error.usage = usage;
      throw error;
    }
  }

  /**
   * Evaluates impact of a potential plan change / downgrade.
   */
  static async evaluatePlanChange(
    companyId: string,
    targetPlanSlug: string,
    executor: any = db
  ): Promise<{
    currentUsage: number;
    targetLimit: number;
    isDowngrade: boolean;
    willExceed: boolean;
    excessCount: number;
  }> {
    const currentUsage = await this.getEmployeeUsage(companyId, executor);
    const [targetPlan] = await executor
      .select()
      .from(saasPlans)
      .where(eq(saasPlans.slug, targetPlanSlug))
      .limit(1);

    const targetLimit = targetPlan
      ? targetPlan.employeeLimit
      : (DEFAULT_SAAS_PLANS.find((p) => p.slug === targetPlanSlug)?.employeeLimit ?? 5);

    const willExceed = currentUsage > targetLimit;
    const excessCount = Math.max(0, currentUsage - targetLimit);

    return {
      currentUsage,
      targetLimit,
      isDowngrade: targetLimit < currentUsage,
      willExceed,
      excessCount,
    };
  }
}
