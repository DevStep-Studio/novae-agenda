import { api } from "./api-client";

export type MembershipPlanDTO = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number;
  billingPeriod: string;
  frequencyType: string;
  sessionsPerPeriod: number;
  weeklyFrequency: number;
  allowReschedule: boolean;
  rescheduleHoursNotice: number;
  allowCarryOver: boolean;
  badgeColor?: string | null;
  active: boolean;
  services?: Array<{ id: string; name: string }>;
  employees?: Array<{ id: string; name: string }>;
};

export type CustomerMembershipDTO = {
  id: string;
  companyId: string;
  clientId: string;
  membershipPlanId: string;
  startsAt: string;
  endsAt?: string | null;
  status: "active" | "paused" | "cancelled" | "expired" | "pending";
  clientName?: string;
  clientPhone?: string;
  planName?: string;
  monthlyPriceSnapshot: number;
  currentPeriod?: {
    sessionsBooked: number;
    sessionsUsed: number;
    sessionAllowance: number;
    paymentStatus: string;
  };
};

export async function getMembershipPlans() {
  return api<MembershipPlanDTO[]>("/api/membership-plans");
}

export async function getCustomerMemberships(params: { clientId?: string; status?: string } = {}) {
  const q = new URLSearchParams();
  if (params.clientId) q.set("clientId", params.clientId);
  if (params.status) q.set("status", params.status);
  const queryStr = q.toString() ? `?${q.toString()}` : "";
  return api<CustomerMembershipDTO[]>(`/api/customer-memberships${queryStr}`);
}
