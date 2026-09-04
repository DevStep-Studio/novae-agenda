import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appointmentServices, appointments, clients, employees, payments, services } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { addMinutesToTime, centsToNumber, isUuid, isValidDateKey, isValidTime, normalizeTime, timeToMinutes } from "@/lib/domain";
import type { AppointmentDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Atendimento não encontrado." }, { status: 404 });

  const [apt] = await db
    .select({
      id: appointments.id,
      appointmentDate: appointments.appointmentDate,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      clientId: appointments.clientId,
      clientName: clients.name,
      clientPhone: clients.phone,
      employeeId: appointments.employeeId,
      employeeName: employees.name,
      total: appointments.total,
      status: appointments.status,
      notes: appointments.notes,
    })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.id))
    .innerJoin(employees, eq(appointments.employeeId, employees.id))
    .where(and(eq(appointments.id, id), eq(appointments.companyId, auth.user.companyId)))
    .limit(1);

  if (!apt) return Response.json({ error: "Atendimento não encontrado." }, { status: 404 });

  const serviceRows = await db
    .select({ serviceId: appointmentServices.serviceId, name: services.name, color: services.color, durationMinutes: appointmentServices.durationMinutes, price: appointmentServices.price })
    .from(appointmentServices)
    .innerJoin(services, eq(appointmentServices.serviceId, services.id))
    .where(eq(appointmentServices.appointmentId, id));

  const [payment] = await db.select({ id: payments.id }).from(payments).where(eq(payments.appointmentId, id)).limit(1);

  const names = serviceRows.map((row) => row.name);
  const dto: AppointmentDTO = {
    id: apt.id,
    date: apt.appointmentDate,
    startTime: normalizeTime(apt.startTime),
    endTime: normalizeTime(apt.endTime),
    durationMinutes: serviceRows.reduce((sum, row) => sum + row.durationMinutes, 0),
    clientId: apt.clientId,
    clientName: apt.clientName,
    clientPhone: apt.clientPhone ?? "",
    clientInitials: initials(apt.clientName),
    clientColor: "#d8e5f0",
    employeeId: apt.employeeId,
    employeeName: apt.employeeName,
    employeeInitials: initials(apt.employeeName),
    serviceId: serviceRows[0]?.serviceId ?? "",
    serviceName: names.join(" + ") || "Serviço",
    serviceColor: serviceRows[0]?.color ?? null,
    total: centsToNumber(apt.total),
    status: apt.status as AppointmentDTO["status"],
    notes: apt.notes,
    paid: Boolean(payment),
  };

  return Response.json({ data: dto });
}

const statusSchema = z.object({
  status: z.enum(["scheduled", "confirmed", "waiting", "in_progress", "cancelled", "no_show"]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Atendimento não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Status inválido." }, { status: 400 });
  }

  const patch: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === "cancelled") patch.cancelledAt = new Date();

  const [updated] = await db
    .update(appointments)
    .set(patch)
    .where(and(eq(appointments.id, id), eq(appointments.companyId, auth.user.companyId)))
    .returning({ id: appointments.id });

  if (!updated) return Response.json({ error: "Atendimento não encontrado." }, { status: 404 });

  return Response.json({ data: { id: updated.id, status: parsed.data.status } });
}

const rescheduleSchema = z.object({
  employeeId: z.string().optional(),
  date: z.string(),
  startTime: z.string(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Atendimento não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = rescheduleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const { date, startTime } = parsed.data;
  if (!isValidDateKey(date) || !isValidTime(startTime)) {
    return Response.json({ error: "Data ou horário inválido." }, { status: 400 });
  }

  const [apt] = await db
    .select({ id: appointments.id, employeeId: appointments.employeeId })
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.companyId, auth.user.companyId)))
    .limit(1);
  if (!apt) return Response.json({ error: "Atendimento não encontrado." }, { status: 404 });

  const employeeId = parsed.data.employeeId ?? apt.employeeId;
  if (parsed.data.employeeId) {
    const [employee] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.companyId, auth.user.companyId)))
      .limit(1);
    if (!employee) return Response.json({ error: "Profissional não encontrado." }, { status: 404 });
  }

  const duration = await db
    .select({ durationMinutes: appointmentServices.durationMinutes, serviceId: appointmentServices.serviceId })
    .from(appointmentServices)
    .where(eq(appointmentServices.appointmentId, id));
  const totalDuration = duration.reduce((sum, row) => sum + row.durationMinutes, 0);
  const endTime = addMinutesToTime(startTime, totalDuration);

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  const overlapping = await db
    .select({ id: appointments.id, startTime: appointments.startTime, endTime: appointments.endTime, status: appointments.status })
    .from(appointments)
    .where(
      and(
        eq(appointments.companyId, auth.user.companyId),
        eq(appointments.employeeId, employeeId),
        eq(appointments.appointmentDate, date),
      ),
    );

  for (const existing of overlapping) {
    if (existing.id === id) continue;
    if (existing.status === "cancelled" || existing.status === "no_show") continue;
    const existingStart = timeToMinutes(normalizeTime(existing.startTime));
    const existingEnd = timeToMinutes(normalizeTime(existing.endTime));
    if (startMinutes < existingEnd && endMinutes > existingStart) {
      return Response.json({ error: "Este profissional já possui um atendimento nesse horário." }, { status: 409 });
    }
  }

  const [updated] = await db
    .update(appointments)
    .set({ employeeId, appointmentDate: date, startTime: `${startTime}:00`, endTime: `${endTime}:00` })
    .where(and(eq(appointments.id, id), eq(appointments.companyId, auth.user.companyId)))
    .returning({ id: appointments.id });

  return Response.json({ data: { id: updated.id, date, startTime, endTime } });
}

const finishSchema = z.object({
  amount: z.number().min(0, "O valor não pode ser negativo."),
  method: z.enum(["pix", "cash", "debit", "credit", "other"]),
  idempotencyKey: z.string().optional(),
});

export async function finishAppointment(id: string, companyId: string, amount: number, method: string) {
  const [apt] = await db
    .select({ id: appointments.id, clientId: appointments.clientId, employeeId: appointments.employeeId, total: appointments.total })
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.companyId, companyId)))
    .limit(1);
  if (!apt) return null;

  const [existingPayment] = await db.select({ id: payments.id }).from(payments).where(eq(payments.appointmentId, id)).limit(1);
  if (existingPayment) return existingPayment;

  await db
    .update(appointments)
    .set({ status: "completed", total: amount.toFixed(2) })
    .where(and(eq(appointments.id, id), eq(appointments.companyId, companyId)));

  const [payment] = await db
    .insert(payments)
    .values({ companyId, appointmentId: id, amount: amount.toFixed(2), method, status: "paid", paidAt: new Date() })
    .returning();

  return payment;
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}
