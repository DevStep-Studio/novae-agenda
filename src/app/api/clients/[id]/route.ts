import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appointments, clients, employees, services, appointmentServices, payments } from "@/db/schema";
import { requireAuth, requireRole, unauthorized } from "@/lib/auth";
import { centsToNumber, isUuid, normalizeTime } from "@/lib/domain";
import type { ClientDetailDTO, HistoryItemDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Cliente não encontrado." }, { status: 404 });

  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.companyId, auth.user.companyId)))
    .limit(1);

  if (!client) return Response.json({ error: "Cliente não encontrado." }, { status: 404 });

  const historyRows = await db
    .select({
      id: appointments.id,
      date: appointments.appointmentDate,
      startTime: appointments.startTime,
      status: appointments.status,
      total: appointments.total,
      employeeName: employees.name,
      serviceName: services.name,
      serviceId: appointmentServices.serviceId,
    })
    .from(appointments)
    .innerJoin(employees, eq(appointments.employeeId, employees.id))
    .innerJoin(appointmentServices, eq(appointmentServices.appointmentId, appointments.id))
    .innerJoin(services, eq(services.id, appointmentServices.serviceId))
    .where(and(eq(appointments.clientId, id), eq(appointments.companyId, auth.user.companyId)))
    .orderBy(desc(appointments.appointmentDate), desc(appointments.startTime))
    .limit(100);

  const history: HistoryItemDTO[] = historyRows.map((row) => ({
    id: row.id,
    date: row.date,
    time: normalizeTime(row.startTime),
    service: row.serviceName,
    employee: row.employeeName,
    total: centsToNumber(row.total),
    status: row.status as HistoryItemDTO["status"],
  }));

  const completedAppointmentIds = new Set(
    historyRows.filter((row) => row.status === "completed").map((row) => row.id),
  );

  const [spentRow] = await db
    .select({ spent: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
    .where(and(eq(appointments.clientId, id), eq(payments.status, "paid")));

  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: auth.companyTimezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [next] = await db
    .select({ date: appointments.appointmentDate, startTime: appointments.startTime })
    .from(appointments)
    .where(
      and(
        eq(appointments.clientId, id),
        eq(appointments.companyId, auth.user.companyId),
        isNull(appointments.cancelledAt),
        inArray(appointments.status, ["scheduled", "confirmed", "waiting"]),
        gte(appointments.appointmentDate, todayKey),
      ),
    )
    .orderBy(appointments.appointmentDate, appointments.startTime)
    .limit(1);

  const completedRow = historyRows.find((row) => row.status === "completed");

  const detail: ClientDetailDTO = {
    id: client.id,
    name: client.name,
    phone: client.phone ?? "",
    email: client.email,
    notes: client.notes,
    active: client.active,
    initials: client.name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join(""),
    color: "#d8e5f0",
    visits: completedAppointmentIds.size,
    spent: centsToNumber(spentRow?.spent),
    lastVisit: completedRow?.date ?? null,
    nextVisit: next ? `${next.date} ${normalizeTime(next.startTime)}` : null,
    createdAt: client.createdAt.toISOString(),
    history,
  };

  return Response.json({ data: detail });
}

const updateSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(8).max(20),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth) return unauthorized();
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Cliente não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { name, phone, email, notes } = parsed.data;
  const [updated] = await db
    .update(clients)
    .set({
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      notes: notes?.trim() || null,
    })
    .where(and(eq(clients.id, id), eq(clients.companyId, auth.user.companyId)))
    .returning();

  if (!updated) return Response.json({ error: "Cliente não encontrado." }, { status: 404 });

  return Response.json({ data: { id: updated.id } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("manager");
  if (gate.response) return gate.response;
  const { auth } = gate;
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Cliente não encontrado." }, { status: 404 });

  const [deleted] = await db
    .update(clients)
    .set({ active: false })
    .where(and(eq(clients.id, id), eq(clients.companyId, auth.user.companyId)))
    .returning({ id: clients.id });

  if (!deleted) return Response.json({ error: "Cliente não encontrado." }, { status: 404 });

  return Response.json({ data: { id: deleted.id } });
}
