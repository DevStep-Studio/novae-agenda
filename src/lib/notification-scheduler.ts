import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  companies,
  clients,
  users,
  notificationSchedules,
  notifications,
  appointments,
  services,
  employees,
} from "@/db/schema";
import { sendPushToCustomer, sendPushToUser, sendPushToCompany } from "./push-notifications";
import { localDate, localTime } from "./booking/time";
import type { DbExecutor } from "./availability";
import { assertServerOnly } from "./server-guard";

assertServerOnly("O agendador de notificações");

/**
 * Schedules all necessary automated reminders (e.g. 2h before service) for a booking.
 * Guarantees idempotency via unique idempotency_key in MySQL.
 */
export async function scheduleBookingReminders(
  tx: DbExecutor,
  booking: typeof bookings.$inferSelect
) {
  if (!booking || booking.status === "cancelled") return;

  const now = new Date();
  const startsAt = new Date(booking.startsAt);

  // 1. 2-Hour Reminder for Customer
  const reminder2hTime = new Date(startsAt.getTime() - 2 * 60 * 60 * 1000);
  if (reminder2hTime > now) {
    const idempotencyKey = `booking_${booking.id}_rev${booking.revision}_customer_reminder_2h`;
    
    // Check if already scheduled
    const [existing] = await tx
      .select({ id: notificationSchedules.id })
      .from(notificationSchedules)
      .where(eq(notificationSchedules.idempotencyKey, idempotencyKey))
      .limit(1);

    if (!existing) {
      await tx.insert(notificationSchedules).values({
        bookingId: booking.id,
        companyId: booking.companyId,
        eventType: "reminder_2h",
        recipientType: "customer",
        recipientId: booking.userId || booking.clientId || null,
        scheduledFor: reminder2hTime,
        status: "pending",
        attempts: 0,
        idempotencyKey,
      });
    }
  }

  // 2. 15-Minute Operational Reminder for Assigned Employee
  const reminder15mTime = new Date(startsAt.getTime() - 15 * 60 * 1000);
  if (reminder15mTime > now) {
    const idempotencyKey = `booking_${booking.id}_rev${booking.revision}_staff_reminder_15m`;

    const [existingStaff] = await tx
      .select({ id: notificationSchedules.id })
      .from(notificationSchedules)
      .where(eq(notificationSchedules.idempotencyKey, idempotencyKey))
      .limit(1);

    if (!existingStaff) {
      await tx.insert(notificationSchedules).values({
        bookingId: booking.id,
        companyId: booking.companyId,
        eventType: "reminder_15m",
        recipientType: "employee",
        recipientId: null, // Will resolve assigned employees at dispatch
        scheduledFor: reminder15mTime,
        status: "pending",
        attempts: 0,
        idempotencyKey,
      });
    }
  }
}

/**
 * Cancels all pending reminders for a given booking (e.g. on cancellation or before rescheduling).
 */
export async function cancelBookingSchedules(tx: DbExecutor, bookingId: string) {
  if (!bookingId) return;

  await tx
    .update(notificationSchedules)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
    })
    .where(
      and(
        eq(notificationSchedules.bookingId, bookingId),
        eq(notificationSchedules.status, "pending")
      )
    );
}

/**
 * Worker / Cron runner to process pending scheduled notifications.
 * Fetches pending records where scheduled_for <= NOW().
 */
export async function processPendingNotificationSchedules(limit = 50): Promise<{
  processed: number;
  sent: number;
  failed: number;
  cancelled: number;
}> {
  const now = new Date();

  // Find pending items due for processing
  const pendingSchedules = await db
    .select()
    .from(notificationSchedules)
    .where(
      and(
        eq(notificationSchedules.status, "pending"),
        lte(notificationSchedules.scheduledFor, now)
      )
    )
    .limit(limit);

  let sent = 0;
  let failed = 0;
  let cancelled = 0;

  for (const schedule of pendingSchedules) {
    try {
      // 1. Fetch booking & company details
      const [booking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, schedule.bookingId))
        .limit(1);

      if (!booking || booking.status === "cancelled" || now > new Date(booking.endsAt)) {
        await db
          .update(notificationSchedules)
          .set({
            status: "cancelled",
            cancelledAt: new Date(),
            lastError: booking?.status === "cancelled" ? "Booking cancelled" : "Booking expired before dispatch",
          })
          .where(eq(notificationSchedules.id, schedule.id));
        cancelled++;
        continue;
      }

      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, booking.companyId))
        .limit(1);

      const timezone = company?.timezone || "America/Sao_Paulo";
      const timeStr = localTime(booking.startsAt, timezone);
      const dateStr = localDate(booking.startsAt, timezone);

      if (schedule.eventType === "reminder_2h" && schedule.recipientType === "customer") {
        // Customer 2h Reminder
        const customerRecipient = booking.userId || schedule.recipientId;

        if (customerRecipient) {
          await sendPushToCustomer(customerRecipient, {
            title: "Lembrete de agendamento",
            body: `Seu agendamento em ${company?.name || "Reservei"} começa em 2 horas (às ${timeStr}).`,
            data: {
              type: "REMINDER_2H",
              bookingId: booking.id,
              url: `/(customer)/`,
            },
            channelId: "reminders",
            priority: "high",
          });

          // Also insert in-app notification for the customer if user account exists
          if (booking.userId) {
            await db.insert(notifications).values({
              id: crypto.randomUUID(),
              companyId: booking.companyId,
              userId: booking.userId,
              type: "booking.reminder.2h",
              title: "Seu agendamento é hoje!",
              body: `Lembrete: seu horário em ${company?.name || "Reservei"} é às ${timeStr}.`,
              entityType: "booking",
              entityId: booking.id,
            });
          }
        }

        await db
          .update(notificationSchedules)
          .set({
            status: "sent",
            sentAt: new Date(),
            attempts: schedule.attempts + 1,
            lastError: null,
          })
          .where(eq(notificationSchedules.id, schedule.id));
        sent++;
      } else if (schedule.eventType === "reminder_15m" && schedule.recipientType === "employee") {
        // Employee 15m Reminder
        // Find assigned employees
        const apts = await db
          .select({ employeeId: appointments.employeeId })
          .from(appointments)
          .where(eq(appointments.bookingId, booking.id));

        const employeeIds = [...new Set(apts.map((a) => a.employeeId))];

        for (const empId of employeeIds) {
          const [emp] = await db
            .select({ userId: employees.userId })
            .from(employees)
            .where(eq(employees.id, empId))
            .limit(1);

          if (emp?.userId) {
            await sendPushToUser(emp.userId, {
              title: "Próximo atendimento em 15min",
              body: `Atendimento agendado para às ${timeStr}.`,
              data: {
                type: "EMPLOYEE_REMINDER_15M",
                bookingId: booking.id,
                url: `/(employee)/agenda`,
              },
              channelId: "reminders",
              priority: "high",
            });
          }
        }

        await db
          .update(notificationSchedules)
          .set({
            status: "sent",
            sentAt: new Date(),
            attempts: schedule.attempts + 1,
            lastError: null,
          })
          .where(eq(notificationSchedules.id, schedule.id));
        sent++;
      } else {
        // Unknown or custom schedule
        await db
          .update(notificationSchedules)
          .set({
            status: "sent",
            sentAt: new Date(),
            attempts: schedule.attempts + 1,
          })
          .where(eq(notificationSchedules.id, schedule.id));
        sent++;
      }
    } catch (err: any) {
      failed++;
      const nextAttempts = schedule.attempts + 1;
      const finalStatus = nextAttempts >= 3 ? "failed" : "pending";

      await db
        .update(notificationSchedules)
        .set({
          status: finalStatus,
          attempts: nextAttempts,
          lastError: err?.message || String(err),
        })
        .where(eq(notificationSchedules.id, schedule.id));
    }
  }

  return {
    processed: pendingSchedules.length,
    sent,
    failed,
    cancelled,
  };
}
