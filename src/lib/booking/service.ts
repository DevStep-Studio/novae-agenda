import { assertSubscriptionActive } from "@/lib/subscriptions";
import { waitlistMatches } from "./waitlist";
import { quoteBooking } from "./pricing";
import { and, asc, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
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
  customerCredentials,
  employees,
  locations,
  notificationLogs,
  notifications,
  products,
  services,
  users,
} from "@/db/schema";
import { normalizePhoneDigits } from "@/lib/domain";
import type { DbExecutor } from "@/lib/availability";
import type { z } from "zod";
import { publicCompany } from "./catalog";
import { loadAvailability, type AvailableSlot } from "./engine";
import { BookingError } from "./errors";
import { canCustomerChange, localDate, localInstant, localTime } from "./time";
import type { createBookingSchema } from "./validation";
export async function lockCompany(tx: DbExecutor, companyId: string) {
  await tx.execute(
    sql`SELECT id FROM companies WHERE id = ${companyId} FOR UPDATE`,
  );
}
export async function lockCompanyBySlug(tx: DbExecutor, slug: string) {
  await tx.execute(
    sql`SELECT id FROM companies WHERE public_slug = ${slug} FOR UPDATE`,
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
  if (event === "booking.cancelled") {
    const matches = await waitlistMatches(booking.companyId, tx, localDate(booking.startsAt, booking.timezone));
    const count = matches.filter(entry => entry.available).length;
    if (count) await tx.insert(notifications).values({ companyId: booking.companyId, type: "waitlist.available", title: `${count} clientes aguardam um horário semelhante.`, body: "Consulte a lista de espera para ver as vagas compatíveis.", entityType: "waitlist" });
  }
  const [existingLog] = await tx
    .select({ id: notificationLogs.id })
    .from(notificationLogs)
    .where(and(eq(notificationLogs.bookingId, booking.id), eq(notificationLogs.event, event), eq(notificationLogs.revision, booking.revision)))
    .limit(1);
  if (!existingLog) {
    await tx.insert(notificationLogs).values({ id: crypto.randomUUID(), bookingId: booking.id, event, revision: booking.revision });
  }

  if (event === "booking.created" || event === "booking.rescheduled") {
    for (const hours of [24, 2]) {
      const dueAt = new Date(booking.startsAt.getTime() - hours * 3600000);
      if (dueAt > new Date()) {
        const reminderEvent = `booking.reminder.${hours}`;
        const [existingReminder] = await tx
          .select({ id: notificationLogs.id })
          .from(notificationLogs)
          .where(and(eq(notificationLogs.bookingId, booking.id), eq(notificationLogs.event, reminderEvent), eq(notificationLogs.revision, booking.revision)))
          .limit(1);
        if (!existingReminder) {
          await tx.insert(notificationLogs).values({
            id: crypto.randomUUID(),
            bookingId: booking.id,
            event: reminderEvent,
            revision: booking.revision,
            dueAt,
          });
        }
      }
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
    const aptId = crypto.randomUUID();
    await tx
      .insert(appointments)
      .values({
        id: aptId,
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
      });
    const apt = { id: aptId };
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
  if (!user.phone)
    throw new BookingError("Informe seu telefone antes de confirmar.");
  const phone = user.phone;
  return db.transaction(async (tx) => {
    await lockCompanyBySlug(tx, input.slug);
    const company = await publicCompany(input.slug, tx);
    const subscription = await assertSubscriptionActive(company.id, tx);
    if (!subscription.ok) throw new BookingError("Este estabelecimento não está recebendo novos agendamentos.", 403);
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
    if (!client) {
      const newClientId = crypto.randomUUID();
      await tx
        .insert(clients)
        .values({
          id: newClientId,
          companyId: company.id,
          userId: user.id,
          name: user.name,
          email: user.email,
          phone,
          photoUrl: user.avatarUrl,
        });
      client = {
        id: newClientId,
        companyId: company.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        phone,
        photoUrl: user.avatarUrl,
        document: null,
        notes: null,
        internalNotes: null,
        active: true,
        deletedAt: null,
        deletedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    const quote = await quoteBooking(
      company,
      {
        serviceIds: input.items.map((i) => i.serviceId),
        products: input.products,
        couponCode: input.couponCode,
      },
      tx,
    );
    let effectiveLocationId = input.locationId;
    if (!effectiveLocationId) {
      const [firstLoc] = await tx
        .select()
        .from(locations)
        .where(
          and(
            eq(locations.companyId, company.id),
            eq(locations.active, true),
          ),
        )
        .limit(1);
      if (firstLoc) {
        effectiveLocationId = firstLoc.id;
      } else {
        const newLocId = crypto.randomUUID();
        await tx.insert(locations).values({
          id: newLocId,
          companyId: company.id,
          name: "Unidade Principal",
          address: company.address || "Endereço Principal",
          phone: company.phone || null,
          openTime: "08:00:00",
          closeTime: "19:00:00",
          active: true,
        });
        effectiveLocationId = newLocId;
      }
    }
    const extras = quote.extras;
    const bookingId = crypto.randomUUID();
    const startsAt = localInstant(input.date, input.startTime, company.timezone);
    const endsAt = localInstant(input.date, slot.endTime, company.timezone);
    await tx
      .insert(bookings)
      .values({
        id: bookingId,
        companyId: company.id,
        locationId: effectiveLocationId,
        userId: user.id,
        clientId: client.id,
        startsAt,
        endsAt,
        timezone: company.timezone,
        subtotal: quote.subtotal.toFixed(2),
        discount: quote.discount.toFixed(2),
        total: quote.total.toFixed(2),
        notes: input.notes?.trim() || null,
        couponCode: quote.couponCode,
        idempotencyKey: input.idempotencyKey,
        intendedPaymentMethod: input.intendedPaymentMethod,
      });
    const booking = {
      id: bookingId,
      companyId: company.id,
      locationId: effectiveLocationId,
      userId: user.id,
      clientId: client.id,
      startsAt,
      endsAt,
      timezone: company.timezone,
      status: "confirmed",
      subtotal: quote.subtotal.toFixed(2),
      discount: quote.discount.toFixed(2),
      total: quote.total.toFixed(2),
      paymentStatus: "unpaid",
      paymentType: "PAY_LATER",
      intendedPaymentMethod: input.intendedPaymentMethod ?? null,
      source: "PUBLIC_LINK",
      notes: input.notes?.trim() || null,
      couponCode: quote.couponCode ?? null,
      idempotencyKey: input.idempotencyKey,
      revision: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
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
  const [currentUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [credential] = await db
    .select()
    .from(customerCredentials)
    .where(eq(customerCredentials.userId, userId))
    .limit(1);

  const rawPhone = currentUser?.phone || "";
  const normalizedPhone = rawPhone ? normalizePhoneDigits(rawPhone) : credential?.phoneNormalized || "";

  const userIds = [userId];
  const clientIds = new Set<string>();

  const directClients = await db
    .select({ id: clients.id, userId: clients.userId, phone: clients.phone })
    .from(clients)
    .where(eq(clients.userId, userId));
  for (const c of directClients) {
    clientIds.add(c.id);
  }

  if (normalizedPhone && normalizedPhone.length >= 8) {
    const allMatchingClients = await db
      .select({ id: clients.id, userId: clients.userId, phone: clients.phone })
      .from(clients)
      .where(isNotNull(clients.phone));

    for (const c of allMatchingClients) {
      if (c.phone && normalizePhoneDigits(c.phone) === normalizedPhone) {
        clientIds.add(c.id);
      }
    }
  }

  const clientIdArray = Array.from(clientIds);

  const bookingCondition = clientIdArray.length
    ? or(inArray(bookings.userId, userIds), inArray(bookings.clientId, clientIdArray))
    : inArray(bookings.userId, userIds);

  const whereCondition = id
    ? and(eq(bookings.id, id), bookingCondition)
    : bookingCondition;

  const rows = await db
    .select({
      booking: bookings,
      company: {
        name: companies.name,
        businessType: companies.businessType,
        logoUrl: companies.logoUrl,
        color: companies.publicColor,
        address: companies.address,
        phone: companies.phone,
        slug: companies.publicSlug,
        cancellationHours: companies.cancellationHours,
      },
    })
    .from(bookings)
    .innerJoin(companies, eq(bookings.companyId, companies.id))
    .where(whereCondition)
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
        employeePhotoUrl: employees.photoUrl,
        employeeJobTitle: employees.jobTitle,
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
  input?: { date?: string; startTime?: string; employeeId?: string; reason?: string },
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
    if (action === "reschedule") {
      if (!staffCompanyId && !company.publicEnabled) throw new BookingError("Este estabelecimento não está recebendo remarcações online.", 403);
      const subscription = await assertSubscriptionActive(company.id, tx);
      if (!subscription.ok) throw new BookingError("Este estabelecimento não está recebendo remarcações.", 403);
    }
    let updated: typeof bookings.$inferSelect;
    if (action === "cancel") {
      await tx
        .update(bookings)
        .set({
          status: "cancelled",
          revision: booking.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, id));
      const [updatedRow] = await tx.select().from(bookings).where(eq(bookings.id, id));
      updated = updatedRow;
      await tx
        .update(appointments)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(appointments.bookingId, id));
    } else {
      if (!input?.date || !input?.startTime) throw new BookingError("Informe data e horário.");
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
      await tx
        .update(bookings)
        .set({
          startsAt: localInstant(input.date, input.startTime, company.timezone),
          endsAt: localInstant(input.date, slot.endTime, company.timezone),
          timezone: company.timezone,
          revision: booking.revision + 1,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, id));
      const [updatedRow] = await tx.select().from(bookings).where(eq(bookings.id, id));
      updated = updatedRow;
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

    if (staffCompanyId) {
      let clientUserId = booking.userId || null;
      if (!clientUserId && booking.clientId) {
        const [cl] = await tx
          .select({ userId: clients.userId, phone: clients.phone })
          .from(clients)
          .where(eq(clients.id, booking.clientId))
          .limit(1);
        if (cl?.userId) {
          clientUserId = cl.userId;
        } else if (cl?.phone) {
          const digits = normalizePhoneDigits(cl.phone);
          if (digits.length >= 8) {
            const [u] = await tx
              .select({ id: users.id })
              .from(users)
              .where(eq(users.phone, cl.phone))
              .limit(1);
            if (u) clientUserId = u.id;
          }
        }
      }
      const serviceNames = await tx
        .select({ name: services.name })
        .from(appointmentServices)
        .innerJoin(services, eq(appointmentServices.serviceId, services.id))
        .where(eq(appointmentServices.appointmentId, items[0]?.apt.id));
      const sName = serviceNames.map((s) => s.name).join(" + ") || "Serviço";

      await tx.insert(notifications).values({
        id: crypto.randomUUID(),
        companyId: booking.companyId,
        userId: clientUserId,
        type: action === "cancel" ? "client_notice_cancelled" : "client_notice_rescheduled",
        title:
          action === "cancel"
            ? "Atendimento cancelado pelo estabelecimento"
            : "Horário alterado pelo estabelecimento",
        body: JSON.stringify({
          actionType: action === "cancel" ? "cancelled" : "rescheduled",
          companyName: company.name,
          companyPhone: company.phone || null,
          serviceName: sName,
          oldDate: localDate(booking.startsAt, company.timezone),
          oldStartTime: localTime(booking.startsAt, company.timezone),
          newDate: action === "reschedule" && input?.date ? input.date : undefined,
          newStartTime: action === "reschedule" && input?.startTime ? input.startTime : undefined,
          reason: input?.reason?.trim() || undefined,
        }),
        entityType: "booking",
        entityId: booking.id,
      });
    }

    return updated;
  });
}

