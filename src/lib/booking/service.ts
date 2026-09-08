import { quoteBooking } from "./pricing";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appointmentHistory,
  appointmentServices,
  appointments,
  auditLogs,
  bookingEvents,
  bookingProducts,
  bookings,
  clients,
  companies,
  coupons,
  employees,
  notificationLogs,
  notifications,
  products,
  services,
  users,
} from "@/db/schema";
import type { DbExecutor } from "@/lib/availability";
import type { z } from "zod";
import { publicCompany } from "./catalog";
import { loadAvailability, type AvailableSlot } from "./engine";
import { BookingError } from "./errors";
import { canCustomerChange, localDate, localInstant, localTime } from "./time";
import type { createBookingSchema } from "./validation";
export async function lockCompany(tx: DbExecutor, companyId: string) {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`booking:${companyId}`},0))`,
  );
}
export async function bookingEvent(
  tx: DbExecutor,
  booking: typeof bookings.$inferSelect,
  event: string,
  actorId: string,
  metadata: Record<string, unknown> = {},
) {
  await tx.insert(auditLogs).values({
    companyId: booking.companyId,
    userId: actorId,
    action: event,
    entity: "booking",
    entityId: booking.id,
    metadata,
  });
  await tx.insert(notifications).values({
    companyId: booking.companyId,
    type: event,
    title:
      (
        {
          "booking.created": "Novo agendamento pelo link",
          "booking.cancelled": "Agendamento cancelado",
          "booking.rescheduled": "Agendamento remarcado",
          "booking.confirmed": "Agendamento confirmado",
        } as Record<string, string>
      )[event] ?? "Agendamento atualizado",
    body: `${localDate(booking.startsAt, booking.timezone)} · ${localTime(booking.startsAt, booking.timezone)}`,
    entityType: "booking",
    entityId: booking.id,
  });
  await tx
    .insert(notificationLogs)
    .values({ bookingId: booking.id, event, revision: booking.revision })
    .onConflictDoNothing();
  if (event === "booking.created" || event === "booking.rescheduled") {
    for (const hours of [24, 2]) {
      const dueAt = new Date(booking.startsAt.getTime() - hours * 3600000);
      if (dueAt > new Date())
        await tx
          .insert(notificationLogs)
          .values({
            bookingId: booking.id,
            event: `booking.reminder.${hours}`,
            revision: booking.revision,
            dueAt,
          })
          .onConflictDoNothing();
    }
  }
}
async function writeItems(
  tx: DbExecutor,
  booking: typeof bookings.$inferSelect,
  slot: AvailableSlot,
  date: string,
  actorId: string,
) {
  const baseCents = slot.items.reduce(
    (sum, i) => sum + Math.round(Number(i.price) * 100),
    0,
  );
  const payableCents = Math.round(Number(booking.total) * 100);
  let allocated = 0;
  for (const [index, item] of slot.items.entries()) {
    const charge =
      index === slot.items.length - 1
        ? payableCents - allocated
        : baseCents
          ? Math.round(
              (payableCents * Math.round(Number(item.price) * 100)) / baseCents,
            )
          : 0;
    allocated += charge;
    const [apt] = await tx
      .insert(appointments)
      .values({
        companyId: booking.companyId,
        bookingId: booking.id,
        locationId: booking.locationId,
        clientId: booking.clientId,
        employeeId: item.employeeId,
        appointmentDate: date,
        startTime: item.startTime,
        endTime: item.endTime,
        status: "confirmed",
        total: (charge / 100).toFixed(2),
        notes: booking.notes,
        source: booking.source,
        bufferMinutes: item.bufferMinutes,
      })
      .returning();
    const commission =
      item.commissionType === "percentage"
        ? (Number(item.price) * Number(item.commissionValue)) / 100
        : item.commissionType === "fixed"
          ? Number(item.commissionValue)
          : 0;
    await tx.insert(appointmentServices).values({
      appointmentId: apt.id,
      serviceId: item.serviceId,
      price: item.price,
      durationMinutes: item.durationMinutes,
      commissionType: item.commissionType,
      commissionValue: item.commissionValue,
      commissionAmount: commission.toFixed(2),
    });
    await tx.insert(appointmentHistory).values({
      appointmentId: apt.id,
      actorId,
      action: "booking.created",
      metadata: { bookingId: booking.id },
    });
  }
}
export async function createBooking(
  user: typeof users.$inferSelect,
  input: z.infer<typeof createBookingSchema>,
) {
  if (!user.emailVerified)
    throw new BookingError(
      "Confirme seu e-mail antes de concluir o agendamento.",
      403,
    );
  if (!user.phone)
    throw new BookingError("Informe seu telefone antes de confirmar.");
  const phone = user.phone;
  return db.transaction(async (tx) => {
    const initialCompany = await publicCompany(input.slug, tx);
    await lockCompany(tx, initialCompany.id);
    const company = await publicCompany(input.slug, tx);
    const [existing] = await tx
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.userId, user.id),
          eq(bookings.idempotencyKey, input.idempotencyKey),
        ),
      );
    if (existing) {
      if (existing.companyId !== company.id)
        throw new BookingError("Solicitação inválida.");
      return existing;
    }
    const availability = await loadAvailability(
      company,
      input.locationId,
      input.items,
      input.date,
      input.date,
      tx,
    );
    const slot = availability
      .slots(input.date)
      .find((s) => s.startTime === input.startTime);
    if (!slot)
      throw new BookingError(
        "Este horário acabou de ser reservado. Escolha outro horário.",
        409,
      );
    let [client] = await tx
      .select()
      .from(clients)
      .where(
        and(eq(clients.companyId, company.id), eq(clients.userId, user.id)),
      );
    // Never claim an existing CRM record merely by matching a self-reported phone or email.
    if (!client)
      [client] = await tx
        .insert(clients)
        .values({
          companyId: company.id,
          userId: user.id,
          name: user.name,
          email: user.email,
          phone,
        })
        .returning();
    const quote = await quoteBooking(
      company,
      {
        serviceIds: input.items.map((i) => i.serviceId),
        products: input.products,
        couponCode: input.couponCode,
      },
      tx,
    );
    const extras = quote.extras;
    const [booking] = await tx
      .insert(bookings)
      .values({
        companyId: company.id,
        locationId: input.locationId,
        userId: user.id,
        clientId: client.id,
        startsAt: localInstant(input.date, input.startTime, company.timezone),
        endsAt: localInstant(input.date, slot.endTime, company.timezone),
        timezone: company.timezone,
        subtotal: quote.subtotal.toFixed(2),
        discount: quote.discount.toFixed(2),
        total: quote.total.toFixed(2),
        notes: input.notes?.trim() || null,
        couponCode: quote.couponCode,
        idempotencyKey: input.idempotencyKey,
      })
      .returning();
    await writeItems(tx, booking, slot, input.date, user.id);
    for (const p of extras)
      await tx.insert(bookingProducts).values({
        bookingId: booking.id,
        productId: p.id,
        name: p.name,
        unitPrice: p.price,
        quantity: input.products.find((i) => i.productId === p.id)!.quantity,
      });
    await bookingEvent(tx, booking, "booking.created", user.id);
    await tx.insert(bookingEvents).values({
      companyId: company.id,
      event: "booking_completed",
      sessionId: input.idempotencyKey,
    });
    return booking;
  });
}
export async function ownedBooking(
  id: string,
  userId: string,
  executor: DbExecutor = db,
) {
  const [booking] = await executor
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, id), eq(bookings.userId, userId)));
  if (!booking) throw new BookingError("Agendamento não encontrado.", 404);
  return booking;
}
export async function listBookingDetails(userId: string, id?: string) {
  const rows = await db
    .select({
      booking: bookings,
      company: {
        name: companies.name,
        address: companies.address,
        slug: companies.publicSlug,
        cancellationHours: companies.cancellationHours,
      },
    })
    .from(bookings)
    .innerJoin(companies, eq(bookings.companyId, companies.id))
    .where(
      and(eq(bookings.userId, userId), id ? eq(bookings.id, id) : undefined),
    )
    .orderBy(desc(bookings.startsAt))
    .limit(100);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.booking.id);
  const [allItems, allExtras] = await Promise.all([
    db
      .select({
        bookingId: appointments.bookingId,
        id: appointments.id,
        employeeId: appointments.employeeId,
        employeeName: employees.name,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        date: appointments.appointmentDate,
        status: appointments.status,
        price: appointmentServices.price,
        durationMinutes: appointmentServices.durationMinutes,
        serviceId: services.id,
        name: services.name,
      })
      .from(appointments)
      .innerJoin(employees, eq(appointments.employeeId, employees.id))
      .innerJoin(
        appointmentServices,
        eq(appointmentServices.appointmentId, appointments.id),
      )
      .innerJoin(services, eq(services.id, appointmentServices.serviceId))
      .where(inArray(appointments.bookingId, ids))
      .orderBy(asc(appointments.startTime)),
    db
      .select()
      .from(bookingProducts)
      .where(inArray(bookingProducts.bookingId, ids)),
  ]);
  return rows.map(({ booking, company }) => {
    const items = allItems.filter((i) => i.bookingId === booking.id),
      extras = allExtras.filter((p) => p.bookingId === booking.id);
    const canChange =
      canCustomerChange(booking.startsAt, company.cancellationHours) &&
      ["confirmed", "scheduled"].includes(booking.status) &&
      items.every((i) => ["confirmed", "scheduled"].includes(i.status));
    return { ...booking, company, items, products: extras, canChange };
  });
}
export async function bookingDetails(id: string, userId: string) {
  const [detail] = await listBookingDetails(userId, id);
  if (!detail) throw new BookingError("Agendamento não encontrado.", 404);
  return detail;
}
export type BookingDetails = Awaited<ReturnType<typeof bookingDetails>>;
export async function changeBooking(
  id: string,
  userId: string,
  action: "cancel" | "reschedule",
  input?: { date: string; startTime: string; employeeId?: string },
  staffCompanyId?: string,
) {
  return db.transaction(async (tx) => {
    const [initial] = await tx
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.id, id),
          staffCompanyId
            ? eq(bookings.companyId, staffCompanyId)
            : eq(bookings.userId, userId),
        ),
      );
    if (!initial) throw new BookingError("Agendamento não encontrado.", 404);
    await lockCompany(tx, initial.companyId);
    const [booking] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, id))
      .for("update");
    const [company] = await tx
      .select()
      .from(companies)
      .where(eq(companies.id, booking.companyId));
    const items = await tx
      .select({ apt: appointments, serviceId: appointmentServices.serviceId })
      .from(appointments)
      .innerJoin(
        appointmentServices,
        eq(appointments.id, appointmentServices.appointmentId),
      )
      .where(eq(appointments.bookingId, id))
      .orderBy(asc(appointments.startTime));
    if (
      !["confirmed", "scheduled"].includes(booking.status) ||
      items.some((i) => !["confirmed", "scheduled"].includes(i.apt.status))
    )
      throw new BookingError(
        "Este agendamento não pode mais ser alterado.",
        409,
      );
    if (
      !staffCompanyId &&
      !canCustomerChange(booking.startsAt, company.cancellationHours)
    )
      throw new BookingError(
        "O prazo para cancelar ou remarcar terminou. Entre em contato com o estabelecimento.",
        422,
      );
    let updated: typeof bookings.$inferSelect;
    if (action === "cancel") {
      [updated] = await tx
        .update(bookings)
        .set({
          status: "cancelled",
          revision: booking.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, id))
        .returning();
      await tx
        .update(appointments)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(appointments.bookingId, id));
    } else {
      if (!input) throw new BookingError("Informe data e horário.");
      const availability = await loadAvailability(
        company,
        booking.locationId,
        items.map((i) => ({
          serviceId: i.serviceId,
          employeeId:
            staffCompanyId && input.employeeId
              ? input.employeeId
              : i.apt.employeeId,
        })),
        input.date,
        input.date,
        tx,
        id,
      );
      const slot = availability
        .slots(input.date)
        .find((s) => s.startTime === input.startTime);
      if (!slot)
        throw new BookingError(
          "Este horário acabou de ser reservado. Escolha outro horário.",
          409,
        );
      // Temporarily release all old spans inside the same transaction before moving them.
      await tx
        .update(appointments)
        .set({ status: "cancelled" })
        .where(eq(appointments.bookingId, id));
      for (const item of slot.items) {
        const previous = items.find((i) => i.serviceId === item.serviceId)!;
        await tx
          .update(appointments)
          .set({
            employeeId: item.employeeId,
            appointmentDate: input.date,
            startTime: item.startTime,
            endTime: item.endTime,
            bufferMinutes: item.bufferMinutes,
            status: "confirmed",
            updatedAt: new Date(),
          })
          .where(eq(appointments.id, previous.apt.id));
      }
      [updated] = await tx
        .update(bookings)
        .set({
          startsAt: localInstant(input.date, input.startTime, company.timezone),
          endsAt: localInstant(input.date, slot.endTime, company.timezone),
          timezone: company.timezone,
          revision: booking.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, id))
        .returning();
    }
    const event =
      action === "cancel" ? "booking.cancelled" : "booking.rescheduled";
    const metadata = {
      old: {
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        status: booking.status,
      },
      new: {
        startsAt: updated.startsAt,
        endsAt: updated.endsAt,
        status: updated.status,
      },
    };
    await tx.insert(appointmentHistory).values(
      items.map((i) => ({
        appointmentId: i.apt.id,
        actorId: userId,
        action: event,
        metadata,
      })),
    );
    await bookingEvent(tx, updated, event, userId, metadata);
    return updated;
  });
}
