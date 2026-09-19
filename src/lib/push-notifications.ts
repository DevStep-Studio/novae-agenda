import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  pushDevices,
  users,
  bookings,
  companies,
  clients,
  employees,
  appointments,
  appointmentServices,
  services,
} from "@/db/schema";
import { assertServerOnly } from "./server-guard";
import { localDate, localTime } from "./booking/time";

assertServerOnly("O serviço de notificações push");

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: "default" | null;
  badge?: number;
  channelId?: "appointments" | "reminders" | "system" | "default";
  priority?: "default" | "normal" | "high";
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
  priority?: "default" | "normal" | "high";
}

export interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: {
    error?: "DeviceNotRegistered" | "InvalidCredentials" | "MessageTooBig" | "MessageRateExceeded" | string;
  };
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Sends push notifications to a list of Expo push tokens in batches of up to 100.
 * Automatically deactivates tokens that return 'DeviceNotRegistered'.
 */
export async function sendExpoPushNotifications(
  messages: ExpoPushMessage[]
): Promise<{ successCount: number; failureCount: number; invalidTokens: string[] }> {
  if (!messages || messages.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  // Filter valid expo tokens
  const validMessages = messages.filter(
    (m) => typeof m.to === "string" && (m.to.startsWith("ExponentPushToken[") || m.to.startsWith("ExpoPushToken["))
  );

  if (validMessages.length === 0) {
    return { successCount: 0, failureCount: messages.length, invalidTokens: [] };
  }

  // Chunk into batches of 100
  const chunks: ExpoPushMessage[][] = [];
  const chunkSize = 100;
  for (let i = 0; i < validMessages.length; i += chunkSize) {
    chunks.push(validMessages.slice(i, i + chunkSize));
  }

  let successCount = 0;
  let failureCount = 0;
  const invalidTokens: string[] = [];

  for (const chunk of chunks) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        failureCount += chunk.length;
        continue;
      }

      const result = (await response.json()) as { data?: ExpoPushTicket[] };
      const tickets = result.data || [];

      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const token = chunk[i]?.to;

        if (ticket.status === "ok") {
          successCount++;
          if (token) {
            // Update last_success_at
            void db
              .update(pushDevices)
              .set({ lastSuccessAt: new Date(), lastError: null })
              .where(eq(pushDevices.pushToken, token))
              .catch(() => {});
          }
        } else {
          failureCount++;
          const errorType = ticket.details?.error;
          if (token) {
            if (errorType === "DeviceNotRegistered") {
              invalidTokens.push(token);
              // Deactivate invalid device token
              void db
                .update(pushDevices)
                .set({ isActive: false, lastFailureAt: new Date(), lastError: "DeviceNotRegistered" })
                .where(eq(pushDevices.pushToken, token))
                .catch(() => {});
            } else {
              void db
                .update(pushDevices)
                .set({ lastFailureAt: new Date(), lastError: ticket.message || errorType || "Unknown push error" })
                .where(eq(pushDevices.pushToken, token))
                .catch(() => {});
            }
          }
        }
      }
    } catch (err: any) {
      failureCount += chunk.length;
    }
  }

  return { successCount, failureCount, invalidTokens };
}

/**
 * Sends a push notification to all active devices registered to a specific staff user.
 */
export async function sendPushToUser(userId: string, payload: PushNotificationPayload) {
  if (!userId) return;

  const devices = await db
    .select({ token: pushDevices.pushToken })
    .from(pushDevices)
    .where(and(eq(pushDevices.userId, userId), eq(pushDevices.isActive, true)));

  if (devices.length === 0) return;

  const messages: ExpoPushMessage[] = devices.map((d) => ({
    to: d.token,
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    sound: payload.sound !== null ? "default" : null,
    badge: payload.badge,
    channelId: payload.channelId || "default",
    priority: payload.priority || "high",
  }));

  return sendExpoPushNotifications(messages);
}

/**
 * Sends a push notification to all active devices registered to a specific customer.
 */
export async function sendPushToCustomer(customerIdOrUserId: string, payload: PushNotificationPayload) {
  if (!customerIdOrUserId) return;

  const devices = await db
    .select({ token: pushDevices.pushToken })
    .from(pushDevices)
    .where(
      and(
        eq(pushDevices.isActive, true),
        // Match either customerId or userId
        eq(pushDevices.customerId, customerIdOrUserId)
      )
    );

  if (devices.length === 0) {
    // Also check by userId in case the customer registered via userId
    const userDevices = await db
      .select({ token: pushDevices.pushToken })
      .from(pushDevices)
      .where(and(eq(pushDevices.userId, customerIdOrUserId), eq(pushDevices.isActive, true)));
    if (userDevices.length === 0) return;

    const messages: ExpoPushMessage[] = userDevices.map((d) => ({
      to: d.token,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      sound: payload.sound !== null ? "default" : null,
      badge: payload.badge,
      channelId: payload.channelId || "default",
      priority: payload.priority || "high",
    }));

    return sendExpoPushNotifications(messages);
  }

  const messages: ExpoPushMessage[] = devices.map((d) => ({
    to: d.token,
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    sound: payload.sound !== null ? "default" : null,
    badge: payload.badge,
    channelId: payload.channelId || "default",
    priority: payload.priority || "high",
  }));

  return sendExpoPushNotifications(messages);
}

/**
 * Sends a push notification to all owners / managers / staff of a specific company.
 */
export async function sendPushToCompany(
  companyId: string,
  payload: PushNotificationPayload,
  roleFilter?: Array<"owner" | "admin" | "manager" | "employee">
) {
  if (!companyId) return;

  const activeDevices = await db
    .select({ token: pushDevices.pushToken, userId: pushDevices.userId })
    .from(pushDevices)
    .where(and(eq(pushDevices.companyId, companyId), eq(pushDevices.isActive, true)));

  if (activeDevices.length === 0) return;

  let filtered = activeDevices;
  if (roleFilter && roleFilter.length > 0) {
    const userIds = activeDevices.map((d) => d.userId).filter(Boolean) as string[];
    if (userIds.length > 0) {
      const staffUsers = await db
        .select({ id: users.id, role: users.role })
        .from(users);
      const staffRoleMap = new Map(staffUsers.map((u) => [u.id, u.role]));
      filtered = activeDevices.filter(
        (d) => d.userId && staffRoleMap.has(d.userId) && roleFilter.includes(staffRoleMap.get(d.userId) as any)
      );
    } else {
      filtered = [];
    }
  }

  if (filtered.length === 0) return;

  const messages: ExpoPushMessage[] = filtered.map((d) => ({
    to: d.token,
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    sound: payload.sound !== null ? "default" : null,
    badge: payload.badge,
    channelId: payload.channelId || "default",
    priority: payload.priority || "high",
  }));

  return sendExpoPushNotifications(messages);
}

/**
 * Dispatches relevant push notifications to Owner, Employee(s), and Customer
 * based on booking lifecycle events (created, cancelled, rescheduled).
 */
export async function dispatchBookingPushNotifications(
  bookingId: string,
  eventType: "booking.created" | "booking.cancelled" | "booking.rescheduled" | string,
  actorId?: string
) {
  try {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) return;

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, booking.companyId))
      .limit(1);

    const timezone = company?.timezone || "America/Sao_Paulo";
    const dateStr = localDate(booking.startsAt, timezone);
    const timeStr = localTime(booking.startsAt, timezone);
    const companyName = company?.name || "Reservei";

    // Get client name
    let clientName = "Cliente";
    if (booking.clientId) {
      const [c] = await db
        .select({ name: clients.name })
        .from(clients)
        .where(eq(clients.id, booking.clientId))
        .limit(1);
      if (c?.name) clientName = c.name;
    } else if (booking.userId) {
      const [u] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, booking.userId))
        .limit(1);
      if (u?.name) clientName = u.name;
    }

    // Get service names & assigned employees
    const aptRows = await db
      .select({
        employeeId: appointments.employeeId,
        serviceName: services.name,
      })
      .from(appointments)
      .leftJoin(appointmentServices, eq(appointmentServices.appointmentId, appointments.id))
      .leftJoin(services, eq(services.id, appointmentServices.serviceId))
      .where(eq(appointments.bookingId, booking.id));

    const serviceNames = aptRows
      .map((r) => r.serviceName)
      .filter(Boolean)
      .join(" + ") || "Serviço";

    const employeeIds = [...new Set(aptRows.map((r) => r.employeeId).filter(Boolean))] as string[];

    // 1. EVENT: Booking Created
    if (eventType === "booking.created") {
      // Push to Owner / Managers
      await sendPushToCompany(
        booking.companyId,
        {
          title: "Nova reserva recebida!",
          body: `${clientName} agendou ${serviceNames} para ${dateStr} às ${timeStr}.`,
          data: {
            type: "BOOKING_CREATED",
            bookingId: booking.id,
            url: "/(owner)/agenda",
          },
          channelId: "appointments",
          priority: "high",
        },
        ["owner", "admin", "manager"]
      );

      // Push to Assigned Employee(s)
      for (const empId of employeeIds) {
        const [emp] = await db
          .select({ userId: employees.userId })
          .from(employees)
          .where(eq(employees.id, empId))
          .limit(1);

        if (emp?.userId && emp.userId !== actorId) {
          await sendPushToUser(emp.userId, {
            title: "Novo atendimento na sua agenda",
            body: `${clientName} agendou para ${dateStr} às ${timeStr}.`,
            data: {
              type: "EMPLOYEE_BOOKING",
              bookingId: booking.id,
              url: "/(employee)/agenda",
            },
            channelId: "appointments",
            priority: "high",
          });
        }
      }

      // Push to Customer
      const customerTarget = booking.userId || booking.clientId;
      if (customerTarget) {
        await sendPushToCustomer(customerTarget, {
          title: "Agendamento confirmado!",
          body: `Seu horário está reservado para ${dateStr}, às ${timeStr} na ${companyName}.`,
          data: {
            type: "BOOKING_CONFIRMED",
            bookingId: booking.id,
            url: "/(customer)/",
          },
          channelId: "appointments",
          priority: "high",
        });
      }
    }

    // 2. EVENT: Booking Cancelled
    else if (eventType === "booking.cancelled") {
      // Push to Owner / Managers
      await sendPushToCompany(
        booking.companyId,
        {
          title: "Agendamento cancelado",
          body: `O agendamento de ${clientName} para ${dateStr} às ${timeStr} foi cancelado.`,
          data: {
            type: "BOOKING_CANCELLED",
            bookingId: booking.id,
            url: "/(owner)/agenda",
          },
          channelId: "appointments",
          priority: "high",
        },
        ["owner", "admin", "manager"]
      );

      // Push to Assigned Employee(s)
      for (const empId of employeeIds) {
        const [emp] = await db
          .select({ userId: employees.userId })
          .from(employees)
          .where(eq(employees.id, empId))
          .limit(1);

        if (emp?.userId && emp.userId !== actorId) {
          await sendPushToUser(emp.userId, {
            title: "Atendimento cancelado",
            body: `O atendimento de ${dateStr} às ${timeStr} foi cancelado.`,
            data: {
              type: "EMPLOYEE_BOOKING_CANCELLED",
              bookingId: booking.id,
              url: "/(employee)/agenda",
            },
            channelId: "appointments",
            priority: "high",
          });
        }
      }

      // Push to Customer (if cancelled by establishment)
      const customerTarget = booking.userId || booking.clientId;
      if (customerTarget && actorId !== booking.userId) {
        await sendPushToCustomer(customerTarget, {
          title: "Agendamento cancelado",
          body: `Seu agendamento na ${companyName} para ${dateStr} às ${timeStr} foi cancelado.`,
          data: {
            type: "BOOKING_CANCELLED",
            bookingId: booking.id,
            url: "/(customer)/",
          },
          channelId: "appointments",
          priority: "high",
        });
      }
    }

    // 3. EVENT: Booking Rescheduled
    else if (eventType === "booking.rescheduled") {
      // Push to Owner / Managers
      await sendPushToCompany(
        booking.companyId,
        {
          title: "Agendamento remarcado",
          body: `${clientName} alterou para ${dateStr} às ${timeStr}.`,
          data: {
            type: "BOOKING_RESCHEDULED",
            bookingId: booking.id,
            url: "/(owner)/agenda",
          },
          channelId: "appointments",
          priority: "high",
        },
        ["owner", "admin", "manager"]
      );

      // Push to Assigned Employee(s)
      for (const empId of employeeIds) {
        const [emp] = await db
          .select({ userId: employees.userId })
          .from(employees)
          .where(eq(employees.id, empId))
          .limit(1);

        if (emp?.userId && emp.userId !== actorId) {
          await sendPushToUser(emp.userId, {
            title: "Atendimento remarcado",
            body: `Novo horário: ${dateStr} às ${timeStr}.`,
            data: {
              type: "EMPLOYEE_BOOKING_RESCHEDULED",
              bookingId: booking.id,
              url: "/(employee)/agenda",
            },
            channelId: "appointments",
            priority: "high",
          });
        }
      }

      // Push to Customer
      const customerTarget = booking.userId || booking.clientId;
      if (customerTarget) {
        await sendPushToCustomer(customerTarget, {
          title: "Horário alterado",
          body: `Seu agendamento na ${companyName} foi alterado para ${dateStr} às ${timeStr}.`,
          data: {
            type: "BOOKING_RESCHEDULED",
            bookingId: booking.id,
            url: "/(customer)/",
          },
          channelId: "appointments",
          priority: "high",
        });
      }
    }
  } catch (error) {
    console.error("[Push Notifications Dispatch Error]:", error);
  }
}
