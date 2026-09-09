import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appointments, clients, employees, locations, services, appointmentServices, payments } from "@/db/schema";
import { requireAuth, requireRole, unauthorized } from "@/lib/auth";
import { centsToNumber, isUuid, normalizeTime } from "@/lib/domain";
import type { ClientDetailDTO, HistoryItemDTO, PaymentMethod } from "@/shared/types";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("employee");
  if (gate.response) return gate.response;
  const { auth } = gate;
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Cliente não encontrado." }, { status: 404 });

  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.companyId, auth.user.companyId)))
    .limit(1);

  if (!client) return Response.json({ error: "Cliente não encontrado." }, { status: 404 });

  const aptRows = await db
    .select({
      id: appointments.id,
      date: appointments.appointmentDate,
      startTime: appointments.startTime,
      status: appointments.status,
      total: appointments.total,
      employeeName: employees.name,
      locationName: locations.name,
    })
    .from(appointments)
    .innerJoin(employees, eq(appointments.employeeId, employees.id))
    .leftJoin(locations, eq(appointments.locationId, locations.id))
    .where(and(eq(appointments.clientId, id), eq(appointments.companyId, auth.user.companyId)))
    .orderBy(desc(appointments.appointmentDate), desc(appointments.startTime))
    .limit(100);

  const aptIds = aptRows.map((a) => a.id);

  const serviceRows = aptIds.length
    ? await db
        .select({
          appointmentId: appointmentServices.appointmentId,
          serviceName: services.name,
        })
        .from(appointmentServices)
        .innerJoin(services, eq(appointmentServices.serviceId, services.id))
        .where(inArray(appointmentServices.appointmentId, aptIds))
    : [];

  const servicesByApt = new Map<string, string[]>();
  for (const s of serviceRows) {
    const list = servicesByApt.get(s.appointmentId) ?? [];
    list.push(s.serviceName);
    servicesByApt.set(s.appointmentId, list);
  }

  const paymentRows = aptIds.length
    ? await db
        .select({
          appointmentId: payments.appointmentId,
          method: payments.method,
        })
        .from(payments)
        .where(inArray(payments.appointmentId, aptIds))
    : [];

  const paymentByApt = new Map(paymentRows.map((p) => [p.appointmentId, p.method as PaymentMethod]));

  const history: HistoryItemDTO[] = aptRows.map((row) => ({
    id: row.id,
    date: row.date,
    time: normalizeTime(row.startTime),
    service: (servicesByApt.get(row.id) ?? []).join(" + ") || "Serviço",
    employee: row.employeeName,
    locationName: row.locationName,
    total: centsToNumber(row.total),
    paymentMethod: paymentByApt.get(row.id) ?? null,
    status: row.status as HistoryItemDTO["status"],
  }));

  const completedApts = aptRows.filter((row) => row.status === "completed");
  const visits = completedApts.length;

  const [spentRow] = await db
    .select({ spent: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
    .where(and(eq(appointments.clientId, id), eq(payments.status, "paid")));

  const spent = centsToNumber(spentRow?.spent);
  const averageTicket = visits > 0 ? spent / visits : 0;
  const lastVisit = completedApts[0]?.date ?? null;
  const firstVisit = completedApts[completedApts.length - 1]?.date ?? null;

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

  const detail: ClientDetailDTO = {
    id: client.id,
    name: client.name,
    phone: client.phone ?? "",
    email: client.email,
    photoUrl: client.photoUrl ?? null,
    notes: client.notes,
    internalNotes: client.internalNotes ?? null,
    active: client.active,
    initials: client.name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join(""),
    color: "#d8e5f0",
    visits,
    spent,
    firstVisit,
    lastVisit,
    nextVisit: next ? `${next.date} ${normalizeTime(next.startTime)}` : null,
    averageTicket,
    createdAt: client.createdAt.toISOString(),
    history,
  };

  return Response.json({ data: detail });
}

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().min(8).max(20).optional(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  notes: z.string().max(2000).optional().nullable(),
  internalNotes: z.string().max(4000).optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireRole("employee");
  if (gate.response) return gate.response;
  const { auth } = gate;
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Cliente não encontrado." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const { name, phone, email, notes, internalNotes } = parsed.data;
  const updateData: Record<string, any> = {};
  if (name !== undefined) updateData.name = name.trim();
  if (phone !== undefined) updateData.phone = phone.trim();
  if (email !== undefined) updateData.email = email?.trim() || null;
  if (notes !== undefined) updateData.notes = notes?.trim() || null;
  if (internalNotes !== undefined) updateData.internalNotes = internalNotes?.trim() || null;

  const [updated] = await db
    .update(clients)
    .set(updateData)
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
