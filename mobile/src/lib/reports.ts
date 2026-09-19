import { api } from "./api-client";

export type ReportsDataDTO = {
  range: string;
  fromDate: string;
  toDate: string;
  metrics: {
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    noShowAppointments: number;
    realizedRevenue: number;
    forecastRevenue: number;
    totalDiscounts: number;
    averageTicket: number;
    occupancyRate: number;
    newClients: number;
    recurringClients: number;
  };
  peakHours: Array<{ hour: string; count: number }>;
  busyDays: Array<{ date: string; count: number }>;
  byEmployee: Array<{
    employeeId: string;
    name: string;
    photoUrl?: string | null;
    appointments: number;
    revenue: number;
    commission: number;
  }>;
  byMethod: Array<{ method: string; total: number }>;
};

export async function getCompanyReports(range: "today" | "7d" | "30d" | "month" | "prev_month" = "month") {
  return api<ReportsDataDTO>(`/api/reports?range=${range}`);
}
