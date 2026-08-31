import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { appointmentServices, appointments, employees, payments, services } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { centsToNumber, todayKey } from "@/lib/domain";
import type { PaymentMethod, StatsResponse } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "month";
  const timezone = auth.companyTimezone;

  const today = todayKey(timezone);
  const weekStart = shiftDate(today, -7);
  const monthStart = today.slice(0, 8) + "01";

  const from = range === "today" ? today : range === "week" ? weekStart : monthStart;

  const todayApts = await db
    .select({
      id: appointments.id,
      status: appointments.status,
      total: appointments.total,
      clientId: appointments.clientId,
      employeeId: appointments.employeeId,
    })
    .from(appointments)
    .where(and(eq(appointments.companyId, auth.user.companyId), eq(appointments.appointmentDate, today)));

  const completedToday = todayApts.filter((apt) => apt.status === "completed");
  const forecast = todayApts
    .filter((apt) => !["cancelled", "no_show", "completed"].includes(apt.status))
    .reduce((sum, apt) => sum + centsToNumber(apt.total), 0);
  const realizedToday = completedToday.reduce((sum, apt) => sum + centsToNumber(apt.total), 0);
  const uniqueClientsToday = new Set(completedToday.map((apt) => apt.clientId)).size;

  const rangeApts = await db
    .select({ id: appointments.id, status: appointments.status, total: appointments.total, employeeId: appointments.employeeId, appointmentDate: appointments.appointmentDate })
    .from(appointments)
    .where(and(eq(appointments.companyId, auth.user.companyId), gte(appointments.appointmentDate, from), lte(appointments.appointmentDate, today)));

  const completed = rangeApts.filter((apt) => apt.status === "completed");

  const employeeRows = await db.select({ id: employees.id, name: employees.name }).from(employees).where(eq(employees.companyId, auth.user.companyId));
  const employeeName = new Map(employeeRows.map((row) => [row.id, row.name]));

  const byEmployeeMap = new Map<string, { appointments: number; revenue: number; commission: number }>();
  for (const apt of completed) {
    const entry = byEmployeeMap.get(apt.employeeId) ?? { appointments: 0, revenue: 0, commission: 0 };
    entry.appointments += 1;
    entry.revenue += centsToNumber(apt.total);
    byEmployeeMap.set(apt.employeeId, entry);
  }

  const commissions = await db
    .select({ employeeId: appointments.employeeId, commissionAmount: appointmentServices.commissionAmount })
    .from(appointmentServices)
    .innerJoin(appointments, eq(appointmentServices.appointmentId, appointments.id))
    .where(
      and(
        eq(appointments.companyId, auth.user.companyId),
        eq(appointments.status, "completed"),
        gte(appointments.appointmentDate, from),
        lte(appointments.appointmentDate, today),
      ),
    );
  for (const row of commissions) {
    const entry = byEmployeeMap.get(row.employeeId);
    if (entry) entry.commission += centsToNumber(row.commissionAmount);
  }

  const byEmployee = [...byEmployeeMap.entries()].map(([employeeId, value]) => ({
    employeeId,
    employeeName: employeeName.get(employeeId) ?? "Profissional",
    appointments: value.appointments,
    revenue: value.revenue,
    commission: value.commission,
  })).sort((a, b) => b.revenue - a.revenue);

  const paymentsRows = await db
    .select({ method: payments.method, amount: payments.amount })
    .from(payments)
    .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
    .where(
      and(
        eq(payments.companyId, auth.user.companyId),
        eq(payments.status, "paid"),
        gte(appointments.appointmentDate, from),
        lte(appointments.appointmentDate, today),
      ),
    );

  const byMethodMap = new Map<string, number>();
  for (const row of paymentsRows) {
    byMethodMap.set(row.method, (byMethodMap.get(row.method) ?? 0) + centsToNumber(row.amount));
  }
  const byMethod = [...byMethodMap.entries()].map(([method, total]) => ({ method: method as PaymentMethod, total }));

  const byServiceRows = await db
    .select({ serviceId: appointmentServices.serviceId, serviceName: services.name, count: appointmentServices.serviceId })
    .from(appointmentServices)
    .innerJoin(appointments, eq(appointmentServices.appointmentId, appointments.id))
    .innerJoin(services, eq(appointmentServices.serviceId, services.id))
    .where(
      and(
        eq(appointments.companyId, auth.user.companyId),
        eq(appointments.status, "completed"),
        gte(appointments.appointmentDate, from),
        lte(appointments.appointmentDate, today),
      ),
    );

  const byServiceMap = new Map<string, { serviceId: string; serviceName: string; count: number; revenue: number }>();
  for (const row of byServiceRows) {
    const entry = byServiceMap.get(row.serviceId) ?? { serviceId: row.serviceId, serviceName: row.serviceName, count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += centsToNumber(row.count); // placeholder; real revenue below
    byServiceMap.set(row.serviceId, entry);
  }

  const serviceRevenue = await db
    .select({ serviceId: appointmentServices.serviceId, price: appointmentServices.price })
    .from(appointmentServices)
    .innerJoin(appointments, eq(appointmentServices.appointmentId, appointments.id))
    .where(
      and(
        eq(appointments.companyId, auth.user.companyId),
        eq(appointments.status, "completed"),
        gte(appointments.appointmentDate, from),
        lte(appointments.appointmentDate, today),
      ),
    );
  for (const row of serviceRevenue) {
    const entry = byServiceMap.get(row.serviceId);
    if (entry) entry.revenue += centsToNumber(row.price);
  }

  const byService = [...byServiceMap.values()].sort((a, b) => b.count - a.count);

  const monthCompleted = completed.filter((apt) => apt.appointmentDate >= monthStart);
  const weekCompleted = completed.filter((apt) => apt.appointmentDate >= weekStart);

  const response: StatsResponse = {
    today: {
      date: today,
      appointments: todayApts.filter((apt) => !["cancelled", "no_show"].includes(apt.status)).length,
      completed: completedToday.length,
      forecast,
      realized: realizedToday,
      clientsServed: uniqueClientsToday,
      averageTicket: completedToday.length ? realizedToday / completedToday.length : 0,
    },
    week: {
      appointments: weekCompleted.length,
      revenue: weekCompleted.reduce((sum, apt) => sum + centsToNumber(apt.total), 0),
    },
    month: {
      appointments: monthCompleted.length,
      revenue: monthCompleted.reduce((sum, apt) => sum + centsToNumber(apt.total), 0),
    },
    byEmployee,
    byMethod,
    byService,
  };

  return Response.json({ data: response });
}

function shiftDate(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
