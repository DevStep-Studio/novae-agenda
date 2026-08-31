import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { appointmentServices, appointments, payments } from "@/db/schema";
import { centsToNumber } from "@/lib/domain";

export type DateRange = { from: string; to: string };

export async function getCompletedAppointments(companyId: string, range: DateRange) {
  return db
    .select({
      id: appointments.id,
      date: appointments.appointmentDate,
      employeeId: appointments.employeeId,
      total: appointments.total,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.companyId, companyId),
        eq(appointments.status, "completed"),
        gte(appointments.appointmentDate, range.from),
        lte(appointments.appointmentDate, range.to),
      ),
    );
}

export async function getPaymentsByCompany(companyId: string, range: DateRange) {
  return db
    .select({
      id: payments.id,
      method: payments.method,
      amount: payments.amount,
      paidAt: payments.paidAt,
    })
    .from(payments)
    .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
    .where(
      and(
        eq(payments.companyId, companyId),
        eq(payments.status, "paid"),
        gte(appointments.appointmentDate, range.from),
        lte(appointments.appointmentDate, range.to),
      ),
    );
}

export async function getEmployeeCommissions(companyId: string, employeeId: string, range: DateRange) {
  const rows = await db
    .select({
      commissionAmount: appointmentServices.commissionAmount,
    })
    .from(appointmentServices)
    .innerJoin(appointments, eq(appointmentServices.appointmentId, appointments.id))
    .where(
      and(
        eq(appointments.companyId, companyId),
        eq(appointments.employeeId, employeeId),
        eq(appointments.status, "completed"),
        gte(appointments.appointmentDate, range.from),
        lte(appointments.appointmentDate, range.to),
      ),
    );

  return rows.reduce((sum, row) => sum + centsToNumber(row.commissionAmount), 0);
}

export function summarizePayments(rows: Awaited<ReturnType<typeof getPaymentsByCompany>>) {
  const byMethod = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    total += centsToNumber(row.amount);
    byMethod.set(row.method, (byMethod.get(row.method) ?? 0) + centsToNumber(row.amount));
  }
  return { total, byMethod };
}
