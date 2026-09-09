import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appointmentServices,
  appointments,
  clients,
  employeeSchedules,
  employees,
  locations,
  payments,
  services,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { centsToNumber, todayKey } from "@/lib/domain";

export const dynamic = "force-dynamic";

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const gate = await requireRole("manager");
  if (gate.response) return gate.response;
  const { auth } = gate;

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? "month"; // "today" | "7d" | "30d" | "month" | "prev_month"
  const timezone = auth.companyTimezone;
  const companyId = auth.user.companyId;

  const today = todayKey(timezone);

  let fromDate = today;
  let toDate = today;

  if (range === "today") {
    fromDate = today;
    toDate = today;
  } else if (range === "7d") {
    fromDate = shiftDate(today, -7);
    toDate = today;
  } else if (range === "30d") {
    fromDate = shiftDate(today, -30);
    toDate = today;
  } else if (range === "month") {
    fromDate = `${today.slice(0, 7)}-01`;
    toDate = today;
  } else if (range === "prev_month") {
    const curYear = Number(today.slice(0, 4));
    const curMonth = Number(today.slice(5, 7));
    const prevYear = curMonth === 1 ? curYear - 1 : curYear;
    const prevMonth = curMonth === 1 ? 12 : curMonth - 1;
    const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
    fromDate = `${prevMonthStr}-01`;
    // Last day of previous month
    const lastDay = new Date(curYear, curMonth - 1, 0).getDate();
    toDate = `${prevMonthStr}-${String(lastDay).padStart(2, "0")}`;
  }

  /* 1. Appointments in Range */
  const aptRows = await db
    .select({
      id: appointments.id,
      status: appointments.status,
      appointmentDate: appointments.appointmentDate,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      clientId: appointments.clientId,
      employeeId: appointments.employeeId,
      total: appointments.total,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.companyId, companyId),
        gte(appointments.appointmentDate, fromDate),
        lte(appointments.appointmentDate, toDate),
      ),
    );

  const totalAppointments = aptRows.length;
  const completedApts = aptRows.filter((a) => a.status === "completed");
  const cancelledCount = aptRows.filter((a) => a.status === "cancelled").length;
  const noShowCount = aptRows.filter((a) => a.status === "no_show").length;
  const pendingApts = aptRows.filter((a) =>
    ["scheduled", "confirmed", "waiting", "in_progress"].includes(a.status),
  );

  const forecastRevenue = pendingApts.reduce((sum, a) => sum + centsToNumber(a.total), 0);

  /* 2. Realized Revenue from Payments */
  const paymentRows = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      discount: payments.discount,
      method: payments.method,
      paidAt: payments.paidAt,
      createdAt: payments.createdAt,
      employeeId: appointments.employeeId,
    })
    .from(payments)
    .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
    .where(
      and(
        eq(payments.companyId, companyId),
        eq(payments.status, "paid"),
        gte(appointments.appointmentDate, fromDate),
        lte(appointments.appointmentDate, toDate),
      ),
    );

  const realizedRevenue = paymentRows.reduce((sum, p) => sum + centsToNumber(p.amount), 0);
  const totalDiscounts = paymentRows.reduce((sum, p) => sum + centsToNumber(p.discount), 0);
  const averageTicket = completedApts.length > 0 ? realizedRevenue / completedApts.length : 0;

  /* 3. Clients in Range: New vs Recurring */
  const clientIdsInRange = new Set(completedApts.map((a) => a.clientId));
  const newClientsCount = (
    await db
      .select({ count: sql<number>`count(*)` })
      .from(clients)
      .where(
        and(
          eq(clients.companyId, companyId),
          gte(clients.createdAt, new Date(`${fromDate}T00:00:00Z`)),
          lte(clients.createdAt, new Date(`${toDate}T23:59:59Z`)),
        ),
      )
  )[0]?.count ?? 0;

  const totalClientsServed = clientIdsInRange.size;
  const recurringClientsCount = Math.max(0, totalClientsServed - Number(newClientsCount));

  /* 4. Occupancy Rate: Occupied Minutes vs Available Working Minutes */
  let occupiedMinutes = 0;
  for (const apt of completedApts) {
    const [sh, sm] = apt.startTime.split(":").map(Number);
    const [eh, em] = apt.endTime.split(":").map(Number);
    const dur = Math.max(0, eh * 60 + em - (sh * 60 + sm));
    occupiedMinutes += dur;
  }

  // Calculate available capacity from active schedules
  const activeSchedules = await db
    .select()
    .from(employeeSchedules)
    .innerJoin(employees, eq(employeeSchedules.employeeId, employees.id))
    .where(
      and(
        eq(employees.companyId, companyId),
        eq(employees.active, true),
        eq(employeeSchedules.active, true),
      ),
    );

  // Approximate days count
  const dStart = new Date(`${fromDate}T12:00:00Z`);
  const dEnd = new Date(`${toDate}T12:00:00Z`);
  const daysDiff = Math.max(1, Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  let availableDailyMinutes = 0;
  for (const s of activeSchedules) {
    const [sh, sm] = s.employee_schedules.startTime.split(":").map(Number);
    const [eh, em] = s.employee_schedules.endTime.split(":").map(Number);
    let dur = Math.max(0, eh * 60 + em - (sh * 60 + sm));
    if (s.employee_schedules.breakStart && s.employee_schedules.breakEnd) {
      const [bsh, bsm] = s.employee_schedules.breakStart.split(":").map(Number);
      const [beh, bem] = s.employee_schedules.breakEnd.split(":").map(Number);
      dur -= Math.max(0, beh * 60 + bem - (bsh * 60 + bsm));
    }
    availableDailyMinutes += dur;
  }

  const totalAvailableMinutes = Math.max(1, (availableDailyMinutes / 7) * daysDiff);
  const occupancyRate = Math.min(100, Math.round((occupiedMinutes / totalAvailableMinutes) * 100));

  /* 5. Peak Hours & Busy Days */
  const hourCounts = new Map<string, number>();
  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; // 0=Dom, 1=Seg, ... 6=Sáb

  for (const apt of aptRows) {
    const hour = apt.startTime.slice(0, 2);
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);

    const dayIndex = new Date(`${apt.appointmentDate}T12:00:00Z`).getUTCDay();
    dayOfWeekCounts[dayIndex] += 1;
  }

  const peakHours = [...hourCounts.entries()]
    .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const daysLabels = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const busyDays = dayOfWeekCounts.map((count, index) => ({
    day: daysLabels[index],
    count,
  }));

  /* 6. By Employee (Appointments, Revenue, Snapshot Commission) */
  const employeeRows = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(eq(employees.companyId, companyId));
  const employeeNameMap = new Map(employeeRows.map((e) => [e.id, e.name]));

  const byEmployeeMap = new Map<string, { employeeId: string; name: string; appointments: number; revenue: number; commission: number }>();

  for (const emp of employeeRows) {
    byEmployeeMap.set(emp.id, {
      employeeId: emp.id,
      name: emp.name,
      appointments: 0,
      revenue: 0,
      commission: 0,
    });
  }

  for (const p of paymentRows) {
    const entry = byEmployeeMap.get(p.employeeId) ?? {
      employeeId: p.employeeId,
      name: employeeNameMap.get(p.employeeId) ?? "Profissional",
      appointments: 0,
      revenue: 0,
      commission: 0,
    };
    entry.appointments += 1;
    entry.revenue += centsToNumber(p.amount);
    byEmployeeMap.set(p.employeeId, entry);
  }

  // Snapshot commissions from appointmentServices
  const aptIdsInRange = completedApts.map((a) => a.id);
  if (aptIdsInRange.length > 0) {
    const commissions = await db
      .select({
        employeeId: appointments.employeeId,
        commissionAmount: appointmentServices.commissionAmount,
      })
      .from(appointmentServices)
      .innerJoin(appointments, eq(appointmentServices.appointmentId, appointments.id))
      .where(inArray(appointments.id, aptIdsInRange));

    for (const c of commissions) {
      const entry = byEmployeeMap.get(c.employeeId);
      if (entry) entry.commission += centsToNumber(c.commissionAmount);
    }
  }

  const byEmployee = [...byEmployeeMap.values()].sort((a, b) => b.revenue - a.revenue);

  /* 7. By Payment Method */
  const byMethodMap = new Map<string, number>();
  for (const p of paymentRows) {
    byMethodMap.set(p.method, (byMethodMap.get(p.method) ?? 0) + centsToNumber(p.amount));
  }
  const byMethod = [...byMethodMap.entries()].map(([method, total]) => ({ method, total }));

  return Response.json({
    data: {
      range,
      fromDate,
      toDate,
      metrics: {
        totalAppointments,
        completedAppointments: completedApts.length,
        cancelledAppointments: cancelledCount,
        noShowAppointments: noShowCount,
        realizedRevenue,
        forecastRevenue,
        totalDiscounts,
        averageTicket,
        occupancyRate,
        newClients: Number(newClientsCount),
        recurringClients: recurringClientsCount,
      },
      peakHours,
      busyDays,
      byEmployee,
      byMethod,
    },
  });
}
