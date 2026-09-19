import { api } from "./api-client";

// Mirrors StatsResponse in src/shared/types.ts (root project) — GET /api/stats,
// requireRole("manager")+ on the backend.
export type PaymentMethod = "pix" | "cash" | "debit" | "credit" | "other";

export type StatsResponse = {
  today: {
    date: string;
    appointments: number;
    completed: number;
    cancelled: number;
    noShow: number;
    forecast: number;
    realized: number;
    clientsServed: number;
    averageTicket: number;
  };
  week: { appointments: number; revenue: number };
  month: { appointments: number; revenue: number };
  byEmployee: Array<{ employeeId: string; employeeName: string; appointments: number; revenue: number; commission: number }>;
  byMethod: Array<{ method: PaymentMethod; total: number }>;
  byService: Array<{ serviceId: string; serviceName: string; count: number; revenue: number }>;
  customerMembershipRevenue?: number;
  activeCustomerMemberships?: number;
  pendingCustomerMembershipPayments?: number;
  scheduledMembershipSessions?: number;
};

export async function getStats(range: "today" | "week" | "month" = "today") {
  return api<StatsResponse>(`/api/stats?range=${range}`);
}

export { formatBRL } from "./formatters";
