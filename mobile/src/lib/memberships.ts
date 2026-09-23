import { api } from "./api-client";
import type { ServiceDTO } from "./services";
import type { EmployeeDTO } from "./employees";

export type MembershipFrequencyType =
  | "WEEKLY_CALENDAR_BASED"
  | "FIXED_MONTHLY_QUOTA"
  | "CUSTOM_WEEKLY_FREQUENCY";

export type MembershipPlanDTO = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number;
  billingPeriod: string;
  frequencyType: MembershipFrequencyType | string;
  sessionsPerPeriod: number;
  weeklyFrequency: number;
  allowReschedule: boolean;
  rescheduleHoursNotice: number;
  allowCarryOver: boolean;
  noShowConsumesSession?: boolean;
  lateCancelConsumesSession?: boolean;
  badgeColor?: string | null;
  active: boolean;
  activeMembersCount?: number;
  serviceIds?: string[];
  employeeIds?: string[];
  services?: Array<{ id: string; name: string; price?: number; durationMinutes?: number }>;
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

export async function getMembershipPlans(includeInactive = true) {
  const query = includeInactive ? "?includeInactive=true" : "";
  return api<MembershipPlanDTO[]>(`/api/membership-plans${query}`);
}

export async function createMembershipPlan(data: Partial<MembershipPlanDTO>) {
  return api<MembershipPlanDTO>("/api/membership-plans", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMembershipPlan(id: string, data: Partial<MembershipPlanDTO>) {
  return api<MembershipPlanDTO>(`/api/membership-plans/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteMembershipPlan(id: string) {
  return api<{ ok?: boolean }>(`/api/membership-plans/${id}`, {
    method: "DELETE",
  });
}

export async function getCustomerMemberships(params: { clientId?: string; status?: string } = {}) {
  const q = new URLSearchParams();
  if (params.clientId) q.set("clientId", params.clientId);
  if (params.status) q.set("status", params.status);
  const queryStr = q.toString() ? `?${q.toString()}` : "";
  return api<CustomerMembershipDTO[]>(`/api/customer-memberships${queryStr}`);
}
