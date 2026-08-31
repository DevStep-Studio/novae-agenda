import { and, asc, between, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appointmentServices, appointments, clients, employeeServices, employees, services } from "@/db/schema";
import { requireAuth, unauthorized } from "@/lib/auth";
import { addMinutesToTime, centsToNumber, isUuid, isValidDateKey, isValidTime, normalizeTime, timeToMinutes } from "@/lib/domain";
import type { AppointmentDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const employeeId = searchParams.get("employeeId");

  const conditions = [eq(appointments.companyId, auth.user.companyId)];

  if (from && isValidDateKey(from)) {
    conditions.push(to && isValidDateKey(to) ? between(appointments.appointmentDate, from, to) : eq(appointments.appointmentDate, from));
  }
  if (employeeId && employeeId !== "all" && isUuid(employeeId)) {
    if (auth.user.role === "employee" && auth.user.employeeId !== employeeId) {
      return unauthorized();
    }
    conditions.push(eq(appointments.employeeId, employeeId));
  }

  if (auth.user.role === "employee" && auth.user.employeeId) {
    conditions.push(eq(appointments.employeeId, auth.user.employeeId));
  }

  const rows = await db
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
    .where(and(...conditions))
    .orderBy(asc(appointments.appointmentDate), asc(appointments.startTime))
    .limit(1000);

  const appointmentIds = rows.map((row) => row.id);
  const serviceRows = appointmentIds.length
    ? await db
        .select({
          appointmentId: appointmentServices.appointmentId,
          serviceId: appointmentServices.serviceId,
          durationMinutes: appointmentServices.durationMinutes,
        })
        .from(appointmentServices)
        .innerJoin(services, eq(appointmentServices.serviceId, services.id))
        .where(inArray(appointmentServices.appointmentId, appointmentIds))
    : [];

  const serviceByAppointment = new Map<string, { serviceId: string; serviceName: string; serviceColor: string | null; durationMinutes: number }>();
  const serviceMeta = new Map<string, { name: string; color: string | null }>();
  if (serviceRows.length) {
    const serviceIds = [...new Set(serviceRows.map((row) => row.serviceId))];
    const serviceDefs = await db.select({ id: services.id, name: services.name, color: services.color }).from(services).where(inArray(services.id, serviceIds));
    for (const def of serviceDefs) serviceMeta.set(def.id, { name: def.name, color: def.color });
  }
  for (const row of serviceRows) {
    const meta = serviceMeta.get(row.serviceId);
    const current = serviceByAppointment.get(row.appointmentId);
    const accumulated = current?.durationMinutes ?? 0;
    const name = current ? `${current.serviceName} + ${meta?.name ?? "Serviço"}` : meta?.name ?? "Serviço";
    serviceByAppointment.set(row.appointmentId, {
      serviceId: row.serviceId,
      serviceName: name,
      serviceColor: meta?.color ?? null,
      durationMinutes: accumulated + row.durationMinutes,
    });
  }

  const dto: AppointmentDTO[] = rows.map((row) => {
    const svc = serviceByAppointment.get(row.id);
    const start = normalizeTime(row.startTime);
    const end = normalizeTime(row.endTime);
    const duration = svc?.durationMinutes ?? Math.max(timeToMinutes(end) - timeToMinutes(start), 0);
    return {
      id: row.id,
      date: row.appointmentDate,
      startTime: start,
      endTime: end,
      durationMinutes: duration,
      clientId: row.clientId,
      clientName: row.clientName,
      clientPhone: row.clientPhone ?? "",
      clientInitials: initials(row.clientName),
      clientColor: "#d8e5f0",
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      employeeInitials: initials(row.employeeName),
      serviceId: svc?.serviceId ?? "",
      serviceName: svc?.serviceName ?? "Serviço",
      serviceColor: svc?.serviceColor ?? null,
      total: centsToNumber(row.total),
      status: row.status as AppointmentDTO["status"],
      notes: row.notes,
      paid: false,
    };
  });

  return Response.json({ data: dto });
}

const createSchema = z.object({
  clientId: z.string(),
  employeeId: z.string(),
  serviceIds: z.array(z.string()).min(1, "Selecione ao menos um serviço."),
  date: z.string(),
  startTime: z.string(),
  status: z.enum(["scheduled", "confirmed"]).optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const { clientId, employeeId, serviceIds, date, startTime, status, notes } = parsed.data;

  if (!isUuid(clientId) || !isUuid(employeeId)) {
    return Response.json({ error: "Cliente ou profissional inválido." }, { status: 400 });
  }
  if (!isValidDateKey(date) || !isValidTime(startTime)) {
    return Response.json({ error: "Data ou horário inválido." }, { status: 400 });
  }

  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.companyId, auth.user.companyId)))
    .limit(1);
  if (!client) return Response.json({ error: "Cliente não encontrado." }, { status: 404 });

  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.companyId, auth.user.companyId)))
    .limit(1);
  if (!employee) return Response.json({ error: "Profissional não encontrado." }, { status: 404 });

  const serviceRows = await db
    .select({ id: services.id, price: services.price, durationMinutes: services.durationMinutes })
    .from(services)
    .where(and(inArray(services.id, serviceIds), eq(services.companyId, auth.user.companyId)));

  if (serviceRows.length !== serviceIds.length) {
    return Response.json({ error: "Um ou mais serviços não pertencem à sua empresa." }, { status: 400 });
  }

  // Ensure the employee is linked to all requested services
  const links = await db
    .select({ serviceId: employeeServices.serviceId })
    .from(employeeServices)
    .where(inArray(employeeServices.serviceId, serviceIds));
  const linkedIds = new Set(links.map((link) => link.serviceId));
  if (serviceIds.some((id) => !linkedIds.has(id))) {
    return Response.json({ error: "Este profissional não realiza um dos serviços selecionados." }, { status: 400 });
  }

  const durationMinutes = serviceRows.reduce((sum, service) => sum + service.durationMinutes, 0);
  const total = serviceRows.reduce((sum, service) => sum + centsToNumber(service.price), 0);
  const endTime = addMinutesToTime(startTime, durationMinutes);

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  const existing = await db
    .select({ id: appointments.id, startTime: appointments.startTime, endTime: appointments.endTime })
    .from(appointments)
    .where(
      and(
        eq(appointments.companyId, auth.user.companyId),
        eq(appointments.employeeId, employeeId),
        eq(appointments.appointmentDate, date),
        ne(appointments.status, "cancelled"),
        ne(appointments.status, "no_show"),
      ),
    );

  for (const apt of existing) {
    const aptStart = timeToMinutes(normalizeTime(apt.startTime));
    const aptEnd = timeToMinutes(normalizeTime(apt.endTime));
    if (startMinutes < aptEnd && endMinutes > aptStart) {
      return Response.json({ error: "Este profissional já possui um atendimento nesse horário." }, { status: 409 });
    }
  }

  const [created] = await db
    .insert(appointments)
    .values({
      companyId: auth.user.companyId,
      clientId,
      employeeId,
      appointmentDate: date,
      startTime: `${startTime}:00`,
      endTime: `${endTime}:00`,
      status: status ?? "scheduled",
      total: total.toFixed(2),
      notes: notes?.trim() || null,
    })
    .returning();

  // copy commission config into appointment services snapshot
  for (const service of serviceRows) {
    const [link] = await db
      .select({
        employeeId: employeeServices.employeeId,
        commissionType: employeeServices.commissionType,
        commissionValue: employeeServices.commissionValue,
      })
      .from(employeeServices)
      .where(and(eq(employeeServices.employeeId, employeeId), eq(employeeServices.serviceId, service.id)))
      .limit(1);

    let commissionType = "none";
    let commissionValue = 0;
    if (link) {
      commissionType = link.commissionType;
      commissionValue = centsToNumber(link.commissionValue);
    }
    let commissionAmount = 0;
    if (commissionType === "percentage") commissionAmount = (centsToNumber(service.price) * commissionValue) / 100;
    if (commissionType === "fixed") commissionAmount = commissionValue;

    await db.insert(appointmentServices).values({
      appointmentId: created.id,
      serviceId: service.id,
      price: service.price,
      durationMinutes: service.durationMinutes,
      commissionType,
      commissionValue: String(commissionValue),
      commissionAmount: commissionAmount.toFixed(2),
    });
  }

  return Response.json({ data: { id: created.id } }, { status: 201 });
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}
