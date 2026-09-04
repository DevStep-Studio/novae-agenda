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

  const companyId = auth.user.companyId;

  /* ---- appointments in scope (for counts + forecast) ---- */
  const todayApts = await db
    .select({ id: appointments.id, status: appointments.status, total: appointments.total, clientId: appointments.clientId })
    .from(appointments)
    .where(and(eq(appointments.companyId, companyId), eq(appointments.appointmentDate, today)));

  const completedToday = todayApts.filter((apt) => apt.status === "completed");
  const forecast = todayApts
    .filter((apt) => !["cancelled", "no_show", "completed"].includes(apt.status))
    .reduce((sum, apt) => sum + centsToNumber(apt.total), 0);

  const rangeApts = await db
    .select({ id: appointments.id, status: appointments.status, appointmentDate: appointments.appointmentDate })
    .from(appointments)
    .where(and(eq(appointments.companyId, companyId), gte(appointments.appointmentDate, from), lte(appointments.appointmentDate, today)));
  const completedInRange = rangeApts.filter((apt) => apt.status === "completed");

  /* ---- realized revenue: ALWAYS from the payments table, bucketed by when it was RECEIVED ---- */
  const rawPayments = await db
    .select({
      method: payments.method,
      amount: payments.amount,
      paidAt: payments.paidAt,
      createdAt: payments.createdAt,
      employeeId: appointments.employeeId,
    })
    .from(payments)
    .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
    .where(and(eq(payments.companyId, companyId), eq(payments.status, "paid")));

  const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const paymentRows = rawPayments.map((p) => ({
    method: p.method,
    amount: p.amount,
    employeeId: p.employeeId,
    paidDate: dateFmt.format(p.paidAt ?? p.createdAt),
  }));

  const realizedToday = paymentRows
    .filter((p) => p.paidDate === today)
    .reduce((sum, p) => sum + centsToNumber(p.amount), 0);
  const realizedWeek = paymentRows
    .filter((p) => p.paidDate >= weekStart)
    .reduce((sum, p) => sum + centsToNumber(p.amount), 0);
  const realizedMonth = paymentRows
    .filter((p) => p.paidDate >= monthStart)
    .reduce((sum, p) => sum + centsToNumber(p.amount), 0);

  const uniqueClientsToday = new Set(completedToday.map((apt) => apt.clientId)).size;

  /* ---- by employee (revenue from payments, commission from snapshot) ---- */
  const employeeRows = await db.select({ id: employees.id, name: employees.name }).from(employees).where(eq(employees.companyId, companyId));
  const employeeName = new Map(employeeRows.map((row) => [row.id, row.name]));

  const byEmployeeMap = new Map<string, { appointments: number; revenue: number; commission: number }>();
  for (const p of paymentRows) {
    if (p.paidDate < from) continue;
    const entry = byEmployeeMap.get(p.employeeId) ?? { appointments: 0, revenue: 0, commission: 0 };
    entry.appointments += 1;
    entry.revenue += centsToNumber(p.amount);
    byEmployeeMap.set(p.employeeId, entry);
  }

  const commissions = await db
    .select({ employeeId: appointments.employeeId, commissionAmount: appointmentServices.commissionAmount })
    .from(appointmentServices)
    .innerJoin(appointments, eq(appointmentServices.appointmentId, appointments.id))
    .where(
      and(
        eq(appointments.companyId, companyId),
        eq(appointments.status, "completed"),
        gte(appointments.appointmentDate, from),
        lte(appointments.appointmentDate, today),
      ),
    );
  for (const row of commissions) {
    const entry = byEmployeeMap.get(row.employeeId);
    if (entry) entry.commission += centsToNumber(row.commissionAmount);
  }

  const byEmployee = [...byEmployeeMap.entries()]
    .map(([employeeId, value]) => ({
      employeeId,
      employeeName: employeeName.get(employeeId) ?? "Profissional",
      appointments: value.appointments,
      revenue: value.revenue,
      commission: value.commission,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  /* ---- by payment method ---- */
  const byMethodMap = new Map<string, number>();
  for (const p of paymentRows) {
    if (p.paidDate < from) continue;
    byMethodMap.set(p.method, (byMethodMap.get(p.method) ?? 0) + centsToNumber(p.amount));
  }
  const byMethod = [...byMethodMap.entries()].map(([method, total]) => ({ method: method as PaymentMethod, total }));

  /* ---- by service (count + revenue from the price snapshot) ---- */
  const serviceRows = await db
    .select({ serviceId: appointmentServices.serviceId, serviceName: services.name, price: appointmentServices.price })
    .from(appointmentServices)
    .innerJoin(appointments, eq(appointmentServices.appointmentId, appointments.id))
    .innerJoin(services, eq(appointmentServices.serviceId, services.id))
    .where(
      and(
        eq(appointments.companyId, companyId),
        eq(appointments.status, "completed"),
        gte(appointments.appointmentDate, from),
        lte(appointments.appointmentDate, today),
      ),
    );
  const byServiceMap = new Map<string, { serviceId: string; serviceName: string; count: number; revenue: number }>();
  for (const row of serviceRows) {
    const entry = byServiceMap.get(row.serviceId) ?? { serviceId: row.serviceId, serviceName: row.serviceName, count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += centsToNumber(row.price);
    byServiceMap.set(row.serviceId, entry);
  }
  const byService = [...byServiceMap.values()].sort((a, b) => b.count - a.count);

  const response: StatsResponse = {
    today: {
      date: today,
      appointments: todayApts.filter((apt) => !["cancelled", "no_show"].includes(apt.status)).length,
      completed: completedToday.length,
      cancelled: todayApts.filter((apt) => apt.status === "cancelled").length,
      noShow: todayApts.filter((apt) => apt.status === "no_show").length,
      forecast,
      realized: realizedToday,
      clientsServed: uniqueClientsToday,
      averageTicket: completedToday.length ? realizedToday / completedToday.length : 0,
    },
    week: {
      appointments: completedInRange.filter((a) => a.appointmentDate >= weekStart).length,
      revenue: realizedWeek,
    },
    month: {
      appointments: completedInRange.filter((a) => a.appointmentDate >= monthStart).length,
      revenue: realizedMonth,
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
