export type PlanType = "trial" | "pro_monthly" | "pro_yearly" | "enterprise";

export type PlanLimits = {
  maxProfessionals: number;
  maxLocations: number;
  maxBookingsPerMonth: number;
  financialReports: boolean;
  advancedReports: boolean;
  whatsappIntegration: boolean;
  customBranding: boolean;
  calendarSync: boolean;
  waitingList: boolean;
};

export const PLAN_FEATURES: Record<PlanType, PlanLimits> = {
  trial: {
    maxProfessionals: 3,
    maxLocations: 1,
    maxBookingsPerMonth: 150,
    financialReports: true,
    advancedReports: true,
    whatsappIntegration: true,
    customBranding: false,
    calendarSync: true,
    waitingList: true,
  },
  pro_monthly: {
    maxProfessionals: 5,
    maxLocations: 2,
    maxBookingsPerMonth: 600,
    financialReports: true,
    advancedReports: true,
    whatsappIntegration: true,
    customBranding: true,
    calendarSync: true,
    waitingList: true,
  },
  pro_yearly: {
    maxProfessionals: 15,
    maxLocations: 5,
    maxBookingsPerMonth: 3000,
    financialReports: true,
    advancedReports: true,
    whatsappIntegration: true,
    customBranding: true,
    calendarSync: true,
    waitingList: true,
  },
  enterprise: {
    maxProfessionals: 9999,
    maxLocations: 999,
    maxBookingsPerMonth: 999999,
    financialReports: true,
    advancedReports: true,
    whatsappIntegration: true,
    customBranding: true,
    calendarSync: true,
    waitingList: true,
  },
};

export class PlanFeatureService {
  static normalizePlan(plan?: string | null): PlanType {
    if (!plan) return "trial";
    const lower = plan.toLowerCase();
    if (lower.includes("vitalicia") || lower.includes("vitalicio") || lower.includes("lifetime") || lower.includes("enterprise")) return "enterprise";
    if (lower.includes("yearly") || lower.includes("anual")) return "pro_yearly";
    if (lower.includes("pro")) return "pro_monthly";
    return "trial";
  }

  static getLimits(plan?: string | null): PlanLimits {
    const key = this.normalizePlan(plan);
    return PLAN_FEATURES[key] ?? PLAN_FEATURES.trial;
  }

  static canAddProfessional(currentCount: number, plan?: string | null): { allowed: boolean; limit: number } {
    const limits = this.getLimits(plan);
    return {
      allowed: currentCount < limits.maxProfessionals,
      limit: limits.maxProfessionals,
    };
  }

  static canAddLocation(currentCount: number, plan?: string | null): { allowed: boolean; limit: number } {
    const limits = this.getLimits(plan);
    return {
      allowed: currentCount < limits.maxLocations,
      limit: limits.maxLocations,
    };
  }

  static hasCapability(plan: string | null | undefined, capability: keyof PlanLimits): boolean {
    const limits = this.getLimits(plan);
    const value = limits[capability];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    return false;
  }
}
