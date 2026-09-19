import { api } from "./api-client";

export type SaaSPlanDTO = {
  id: string;
  name: string;
  price: number;
  interval: "monthly" | "yearly";
  features: string[];
  recommended?: boolean;
};

export type SubscriptionInvoiceDTO = {
  id: string;
  amount: number;
  status: string;
  paidAt: string | null;
  invoiceUrl?: string | null;
  createdAt: string;
};

export type SubscriptionDTO = {
  id: string;
  companyId: string;
  plan: string;
  status: "trialing" | "active" | "past_due" | "expired" | "canceled" | "pending";
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  billingInterval: "monthly" | "yearly";
  isLifetime?: boolean;
  isYearly?: boolean;
  amount?: number;
};

export type SubscriptionDataResponse = {
  subscription: SubscriptionDTO | null;
  plans: Record<string, any>;
  invoices: SubscriptionInvoiceDTO[];
};

export async function getCompanySubscriptionData() {
  return api<SubscriptionDataResponse>("/api/subscriptions");
}

export async function createCheckoutSession(planKey: "pro_monthly" | "pro_yearly", simulate = false) {
  return api<{ initPoint?: string; isSimulated?: boolean; ok?: boolean }>(
    "/api/subscriptions",
    {
      method: "POST",
      body: JSON.stringify({ planKey, simulate }),
    }
  );
}
