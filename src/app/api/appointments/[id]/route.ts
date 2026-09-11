import { assertSubscriptionActive } from "@/lib/subscriptions";
import { waitlistMatches } from "@/lib/booking/waitlist";
import {
  bookingEvent,
  changeBooking,
  lockCompany,
} from "@/lib/booking/service";
import { bookingError, sameOrigin } from "@/lib/booking/errors";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  appointmentHistory,
  appointmentServices,
  appointments,
  bookings,
  employeeServices,
  clients,
  employees,
  locations,
  notifications,
  payments,
  services,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { assertBookable } from "@/lib/availability";
import { recordAudit } from "@/lib/audit";
import {
  addMinutesToTime,
  centsToNumber,
  isUuid,
  isValidDateKey,
  isValidTime,
  normalizeTime,
  timeToMinutes,
} from "@/lib/domain";
import { getCompanySettings } from "@/lib/settings";
import type { AppointmentDTO } from "@/shared/types";

export const dynamic = "force-dynamic";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

/** Loads an appointment scoped to the company, enforcing employee-only ownership. */
async function loadOwned(
  id: string,
  companyId: string,
  role: string,
  employeeId: string | null,
  executor: Pick<typeof db, "select"> = db,
) {
  const [apt] = await executor
    .select({
      id: appointments.id,
      employeeId: appointments.employeeId,
      status: appointments.status,
      total: appointments.total,
      appointmentDate: appointments.appointmentDate,
      bookingId: appointments.bookingId,
    })
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.companyId, companyId)))
    .limit(1);
  if (!apt) return { apt: null, forbidden: false };
  if (role === "employee" && apt.employeeId !== employeeId)
    return { apt: null, forbidden: true };
  return { apt, forbidden: false };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireRole("employee");
  if (gate.response) return gate.response;
  const { auth } = gate;
  const { id } = await params;
  if (!isUuid(id))
    return Response.json(
      { error: "Atendimento não encontrado." },
      { status: 404 },
    );

  const [apt] = await db
    .select({
      id: appointments.id,
      locationId: appointments.locationId,
      locationName: locations.name,
      appointmentDate: appointments.appointmentDate,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      clientId: appointments.clientId,
      clientName: clients.name,
      clientPhone: clients.phone,
      clientPhotoUrl: clients.photoUrl,
      employeeId: appointments.employeeId,
      employeeName: employees.name,
      total: appointments.total,
      status: appointments.status,
      notes: appointments.notes,
    })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.id))
    .innerJoin(employees, eq(appointments.employeeId, employees.id))
    .leftJoin(locations, eq(appointments.locationId, locations.id))
    .where(
      and(
        eq(appointments.id, id),
        eq(appointments.companyId, auth.user.companyId),
      ),
    )
    .limit(1);

  if (!apt)
    return Response.json(
      { error: "Atendimento não encontrado." },
      { status: 404 },
    );
  if (
    auth.user.role === "employee" &&
    apt.employeeId !== auth.user.employeeId
  ) {
    return Response.json(
      { error: "Atendimento não encontrado." },
      { status: 404 },
    );
  }

  const serviceRows = await db
    .select({
      serviceId: appointmentServices.serviceId,
      name: services.name,
      color: services.color,
      durationMinutes: appointmentServices.durationMinutes,
      price: appointmentServices.price,
    })
    .from(appointmentServices)
    .innerJoin(services, eq(appointmentServices.serviceId, services.id))
    .where(eq(appointmentServices.appointmentId, id));

  const [payment] = await db
    .select({ id: payments.id, method: payments.method })
    .from(payments)
    .where(eq(payments.appointmentId, id))
    .limit(1);

  const names = serviceRows.map((row) => row.name);
  const dto: AppointmentDTO = {
    id: apt.id,
    locationId: apt.locationId,
    locationName: apt.locationName,
    date: apt.appointmentDate,
    startTime: normalizeTime(apt.startTime),
    endTime: normalizeTime(apt.endTime),
    durationMinutes: serviceRows.reduce(
      (sum, row) => sum + row.durationMinutes,
      0,
    ),
    clientId: apt.clientId,
    clientName: apt.clientName,
    clientPhone: apt.clientPhone ?? "",
    clientPhotoUrl: apt.clientPhotoUrl ?? null,
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
    paymentMethod: (payment?.method as AppointmentDTO["paymentMethod"]) ?? null,
  };

  return Response.json({ data: dto });
}

const statusSchema = z.object({
  status: z.enum([
    "scheduled",
    "confirmed",
    "waiting",
    "in_progress",
    "cancelled",
    "no_show",
  ]),
  reason: z.string().max(300).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireRole("employee");
  if (gate.response) return gate.response;
  const { auth } = gate;
  const { id } = await params;
  if (!isUuid(id))
    return Response.json(
      { error: "Atendimento não encontrado." },
      { status: 404 },
    );

  try {
    sameOrigin(request);
    const owned = await loadOwned(
      id,
      auth.user.companyId,
      auth.user.role,
      auth.user.employeeId,
    );
    if (owned.apt?.bookingId) {
      if (auth.user.role === "employee") {
        const siblings = await db
          .select({ employeeId: appointments.employeeId })
          .from(appointments)
          .where(eq(appointments.bookingId, owned.apt.bookingId));
        if (siblings.some((a) => a.employeeId !== auth.user.employeeId))
          return Response.json(
            {
              error:
                "Uma reserva com vários profissionais deve ser alterada pela gerência.",
            },
            { status: 403 },
          );
      }
      const payload = await request.clone().json();
      if (payload.status === "cancelled") {
        const parsedGroup = statusSchema.parse(payload);
        await changeBooking(
          owned.apt.bookingId,
          auth.user.userId,
          "cancel",
          undefined,
          auth.user.companyId,
        );
        return Response.json({ data: { id } });
      }
    }
    return await db.transaction(async (tx) => {
      await lockCompany(tx, auth.user.companyId);
      const body = await request.json().catch(() => null);
      const parsed = statusSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { error: parsed.error.issues[0]?.message ?? "Status inválido." },
          { status: 400 },
        );
      }

      const { apt, forbidden } = await loadOwned(
        id,
        auth.user.companyId,
        auth.user.role,
        auth.user.employeeId,
        tx,
      );
      if (forbidden)
        return Response.json(
          { error: "Você não pode alterar este atendimento." },
          { status: 403 },
        );
      if (!apt)
        return Response.json(
          { error: "Atendimento não encontrado." },
          { status: 404 },
        );
      if (["completed", "cancelled", "no_show"].includes(apt.status)) {
        return Response.json(
          { error: "Este atendimento já foi finalizado." },
          { status: 409 },
        );
      }

      const { status, reason } = parsed.data;
      const patch: Record<string, unknown> = { status };
      if (status === "cancelled" || status === "no_show") {
        patch.cancelledAt = new Date();
        patch.cancelReason = reason?.trim() || null;
      }

      await tx
        .update(appointments)
        .set(patch)
        .where(
          and(
            eq(appointments.id, id),
            eq(appointments.companyId, auth.user.companyId),
          ),
        );

      await tx
        .insert(appointmentHistory)
        .values({
          id: crypto.randomUUID(),
          appointmentId: id,
          actorId: auth.user.userId,
          action: "appointment.status_changed",
          metadata: { from: apt.status, to: status },
        });
      if (apt.bookingId) {
        const siblings = await tx
          .select({ status: appointments.status })
          .from(appointments)
          .where(eq(appointments.bookingId, apt.bookingId));
        if (siblings.every((s) => s.status === status)) {
          await tx
            .update(bookings)
            .set({ status, updatedAt: new Date() })
            .where(eq(bookings.id, apt.bookingId));
          const [parent] = await tx
            .select()
            .from(bookings)
            .where(eq(bookings.id, apt.bookingId));
          if (status === "confirmed" && parent)
            await bookingEvent(
              tx,
              parent,
              "booking.confirmed",
              auth.user.userId,
            );
        }
      }
      if (status === "cancelled" || status === "no_show") {
        await recordAudit({
          companyId: auth.user.companyId,
          userId: auth.user.userId,
          action: `appointment.${status}`,
          entity: "appointment",
          entityId: id,
          metadata: {
            reason: reason?.trim() || null,
            previousStatus: apt.status,
          },
        });
        const matches = await waitlistMatches(auth.user.companyId, tx, apt.appointmentDate);
        const count = matches.filter(e => e.available).length;
        if (count) await tx.insert(notifications).values({ id: crypto.randomUUID(), companyId: auth.user.companyId, type: "waitlist.available", title: `${count} clientes aguardam um horário semelhante.`, entityType: "waitlist" });
        await tx.insert(notifications).values({
          id: crypto.randomUUID(),
          companyId: auth.user.companyId,
          type:
            status === "cancelled"
              ? "appointment_cancelled"
              : "appointment_no_show",
          title:
            status === "cancelled"
              ? "Atendimento cancelado"
              : "Cliente não compareceu",
          body: reason?.trim() || null,
          entityType: "appointment",
          entityId: id,
        });
      }

      return Response.json({ data: { id, status } });
    });
  } catch (error) {
    return bookingError(error);
  }
}

const rescheduleSchema = z.object({
  employeeId: z.string().optional(),
  date: z.string(),
  startTime: z.string(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireRole("employee");
  if (gate.response) return gate.response;
  const { auth } = gate;
  const { id } = await params;
  if (!isUuid(id))
    return Response.json(
      { error: "Atendimento não encontrado." },
      { status: 404 },
    );

  try {
    sameOrigin(request);
    const owned = await loadOwned(
      id,
      auth.user.companyId,
      auth.user.role,
      auth.user.employeeId,
    );
    if (owned.apt?.bookingId) {
      if (auth.user.role === "employee") {
        const siblings = await db
          .select({ employeeId: appointments.employeeId })
          .from(appointments)
          .where(eq(appointments.bookingId, owned.apt.bookingId));
        if (siblings.some((a) => a.employeeId !== auth.user.employeeId))
          return Response.json(
            {
              error:
                "Uma reserva com vários profissionais deve ser alterada pela gerência.",
            },
            { status: 403 },
          );
      }
      const payload = await request.clone().json();
      if (true) {
        const parsedGroup = rescheduleSchema.parse(payload);
        await changeBooking(
          owned.apt.bookingId,
          auth.user.userId,
          "reschedule",
          parsedGroup,
          auth.user.companyId,
        );
        return Response.json({ data: { id } });
      }
    }
    return await db.transaction(async (tx) => {
      await lockCompany(tx, auth.user.companyId);
      const subscription = await assertSubscriptionActive(auth.user.companyId, tx);
      if (!subscription.ok) return Response.json({ error: subscription.reason }, { status: 403 });
      const body = await request.json().catch(() => null);
      const parsed = rescheduleSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
          { status: 400 },
        );
      }
      const { date, startTime } = parsed.data;
      if (!isValidDateKey(date) || !isValidTime(startTime)) {
        return Response.json(
          { error: "Data ou horário inválido." },
          { status: 400 },
        );
      }

      const { apt, forbidden } = await loadOwned(
        id,
        auth.user.companyId,
        auth.user.role,
        auth.user.employeeId,
        tx,
      );
      if (forbidden)
        return Response.json(
          { error: "Você não pode reagendar este atendimento." },
          { status: 403 },
        );
      if (!apt)
        return Response.json(
          { error: "Atendimento não encontrado." },
          { status: 404 },
        );
      if (apt.status === "completed" || apt.status === "cancelled") {
        return Response.json(
          { error: "Este atendimento não pode ser reagendado." },
          { status: 409 },
        );
      }

      const employeeId = parsed.data.employeeId ?? apt.employeeId;
      if (parsed.data.employeeId) {
        if (
          auth.user.role === "employee" &&
          employeeId !== auth.user.employeeId
        ) {
          return Response.json(
            { error: "Você só pode reagendar para a sua própria agenda." },
            { status: 403 },
          );
        }
        const [employee] = await tx
          .select({ id: employees.id })
          .from(employees)
          .where(
            and(
              eq(employees.id, employeeId),
              eq(employees.companyId, auth.user.companyId),
            ),
          )
          .limit(1);
        if (!employee)
          return Response.json(
            { error: "Profissional não encontrado." },
            { status: 404 },
          );
      }

      const linkedServiceRows = await tx
        .select({ serviceId: appointmentServices.serviceId })
        .from(appointmentServices)
        .where(eq(appointmentServices.appointmentId, id));
      const allowedLinks = await tx
        .select()
        .from(employeeServices)
        .where(eq(employeeServices.employeeId, employeeId));
      if (
        linkedServiceRows.some(
          (s) => !allowedLinks.some((l) => l.serviceId === s.serviceId),
        )
      )
        return Response.json(
          { error: "Este profissional não realiza um dos serviços." },
          { status: 400 },
        );
      const durationRows = await tx
        .select({ durationMinutes: appointmentServices.durationMinutes })
        .from(appointmentServices)
        .where(eq(appointmentServices.appointmentId, id));
      const totalDuration = durationRows.reduce(
        (sum, row) => sum + row.durationMinutes,
        0,
      );
      const endTime = addMinutesToTime(startTime, totalDuration);

      const { bufferMinutes } = await getCompanySettings(
        auth.user.companyId,
        tx,
      );
      const check = await assertBookable({
        companyId: auth.user.companyId,
        employeeId,
        date,
        timezone: auth.companyTimezone,
        executor: tx,
        durationMinutes: totalDuration,
        bufferMinutes,
        excludeAppointmentId: id,
        startMinutes: timeToMinutes(startTime),
        endMinutes: timeToMinutes(endTime),
      });
      if (!check.ok)
        return Response.json({ error: check.error }, { status: check.status });

      await tx
        .update(appointments)
        .set({
          employeeId,
          appointmentDate: date,
          startTime: `${startTime}:00`,
          endTime: `${endTime}:00`,
        })
        .where(
          and(
            eq(appointments.id, id),
            eq(appointments.companyId, auth.user.companyId),
          ),
        );

      await tx
        .insert(appointmentHistory)
        .values({
          id: crypto.randomUUID(),
          appointmentId: id,
          actorId: auth.user.userId,
          action: "appointment.rescheduled",
          metadata: { from: apt.appointmentDate, to: date, startTime },
        });
      await recordAudit({
        companyId: auth.user.companyId,
        userId: auth.user.userId,
        action: "appointment.rescheduled",
        entity: "appointment",
        entityId: id,
        metadata: {
          from: { date: apt.appointmentDate },
          to: { date, startTime, endTime, employeeId },
        },
      });

      return Response.json({ data: { id, date, startTime, endTime } });
    });
  } catch (error) {
    return bookingError(error);
  }
}
