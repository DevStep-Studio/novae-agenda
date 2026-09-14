import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { bookings, companies, notificationLogs, users } from "@/db/schema";
import { appUrl, sendMail } from "@/lib/mailer";
import { localDate, localTime } from "./time";
export type BookingChannel = {
  send: (message: {
    to: string;
    subject: string;
    text: string;
    idempotencyKey: string;
  }) => Promise<{ ok: boolean; error?: string }>;
};
const escape = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const emailChannel: BookingChannel = {
  async send(message) {
    if (process.env.EMAIL_TRANSPORT !== "resend")
      return {
        ok: false,
        error: "Configure EMAIL_TRANSPORT=resend para entregar mensagens.",
      };
    return sendMail({
      ...message,
      html: `<div style="font-family:Arial;line-height:1.7;max-width:600px"><h2>Reservei</h2><p>${escape(message.text).replace(/\n/g, "<br>")}</p></div>`,
    });
  },
};
/** A scheduler calls this worker; SKIP LOCKED permits multiple workers without duplicate claims. */
export async function processBookingNotifications(
  limit = 50,
  channel: BookingChannel = emailChannel,
  bookingId?: string,
) {
  let processed = 0;
  for (let i = 0; i < limit; i++) {
    const found = await db.transaction(async (tx) => {
      const [log] = await tx
        .select()
        .from(notificationLogs)
        .where(
          and(
            eq(notificationLogs.status, "pending"),
            lte(notificationLogs.dueAt, new Date()),
            bookingId ? eq(notificationLogs.bookingId, bookingId) : undefined,
          ),
        )
        .orderBy(notificationLogs.dueAt)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!log) return false;
      const [booking] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, log.bookingId));
      if (
        booking.revision !== log.revision ||
        (log.event.startsWith("booking.reminder") &&
          (booking.revision !== log.revision ||
            !["confirmed", "scheduled"].includes(booking.status) ||
            booking.startsAt <= new Date()))
      ) {
        await tx
          .update(notificationLogs)
          .set({ status: "skipped", updatedAt: new Date() })
          .where(eq(notificationLogs.id, log.id));
        return true;
      }
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, booking.userId));
      const [company] = await tx
        .select()
        .from(companies)
        .where(eq(companies.id, booking.companyId));
      const title =
        log.event === "booking.cancelled"
          ? "Seu agendamento foi cancelado"
          : log.event === "booking.rescheduled"
            ? "Seu agendamento foi remarcado"
            : log.event.startsWith("booking.reminder")
              ? "Lembrete do seu agendamento"
              : "Seu agendamento está confirmado";
      const text = `Olá, ${user.name}.\n${title}.\n${company.name}\n${localDate(booking.startsAt, booking.timezone)} às ${localTime(booking.startsAt, booking.timezone)} (${booking.timezone})\nVeja os detalhes: ${appUrl()}/meus-agendamentos?booking=${booking.id}`;
      const result = await channel.send({
        to: user.email,
        subject: title,
        text,
        idempotencyKey: log.id,
      });
      await tx
        .update(notificationLogs)
        .set({
          status: result.ok ? "sent" : log.attempts >= 4 ? "failed" : "pending",
          attempts: log.attempts + 1,
          sentAt: result.ok ? new Date() : null,
          lastError: result.error ?? null,
          dueAt: result.ok
            ? log.dueAt
            : new Date(Date.now() + Math.min(60, 2 ** log.attempts) * 60000),
          updatedAt: new Date(),
        })
        .where(eq(notificationLogs.id, log.id));
      return true;
    });
    if (!found) break;
    processed++;
  }
  return processed;
}
