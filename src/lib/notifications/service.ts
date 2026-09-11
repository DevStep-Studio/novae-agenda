import { and, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, users, employees } from "@/db/schema";
import { eventBus, type AppEvent } from "./event-bus";
import type { NotificationDTO } from "@/shared/types";

export type NotificationCategory = "all" | "unread" | "agendamentos" | "financeiro" | "sistema";

export class NotificationService {
  /**
   * Persist a notification in database
   */
  public static async createNotification(input: {
    companyId: string;
    userId?: string | null;
    type: string;
    title: string;
    body?: string | null;
    entityType?: string | null;
    entityId?: string | null;
  }) {
    try {
      const id = crypto.randomUUID();
      await db.insert(notifications).values({
        id,
        companyId: input.companyId,
        userId: input.userId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        createdAt: new Date(),
      });
      return id;
    } catch (err) {
      console.error("[NotificationService] Failed to insert notification:", err);
      return null;
    }
  }

  /**
   * Retrieve notifications with role scoping and category filtering
   */
  public static async getNotifications(
    companyId: string,
    options: {
      userId?: string | null;
      role?: string;
      isSuperadmin?: boolean;
      category?: NotificationCategory;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ notifications: NotificationDTO[]; total: number; unreadCount: number }> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    const category = options.category ?? "all";

    // Build base where conditions
    const conditions = [eq(notifications.companyId, companyId)];

    // Role-based visibility:
    // If user is a professional / regular employee (not owner, admin, manager, superadmin),
    // they only see notifications addressed directly to them (userId = user.id) or company-wide ones
    if (options.role === "employee" && options.userId && !options.isSuperadmin) {
      conditions.push(or(eq(notifications.userId, options.userId), isNull(notifications.userId))!);
    }

    // Category filtering
    if (category === "unread") {
      conditions.push(isNull(notifications.readAt));
    } else if (category === "agendamentos") {
      conditions.push(
        or(
          like(notifications.type, "booking.%"),
          like(notifications.type, "waitlist.%"),
          like(notifications.type, "customer.%"),
          eq(notifications.entityType, "appointment"),
          eq(notifications.entityType, "waitlist")
        )!
      );
    } else if (category === "financeiro") {
      conditions.push(
        or(
          like(notifications.type, "payment.%"),
          like(notifications.type, "financial.%"),
          like(notifications.type, "subscription.%"),
          eq(notifications.entityType, "financial"),
          eq(notifications.entityType, "subscription")
        )!
      );
    } else if (category === "sistema") {
      conditions.push(
        or(
          like(notifications.type, "system.%"),
          eq(notifications.entityType, "system"),
          eq(notifications.type, "plan.warning")
        )!
      );
    }

    const whereClause = and(...conditions);

    // Fetch notifications
    const rows = await db
      .select()
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    // Calculate unread count for company / role
    const unreadConditions = [eq(notifications.companyId, companyId), isNull(notifications.readAt)];
    if (options.role === "employee" && options.userId && !options.isSuperadmin) {
      unreadConditions.push(or(eq(notifications.userId, options.userId), isNull(notifications.userId))!);
    }

    const unreadResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(...unreadConditions));
    const unreadCount = Number(unreadResult[0]?.count ?? 0);

    const dtos: NotificationDTO[] = rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      entityType: n.entityType,
      entityId: n.entityId,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    }));

    return {
      notifications: dtos,
      total: dtos.length,
      unreadCount,
    };
  }

  /**
   * Fast unread count query
   */
  public static async getUnreadCount(
    companyId: string,
    options: { userId?: string | null; role?: string; isSuperadmin?: boolean } = {}
  ): Promise<number> {
    const conditions = [eq(notifications.companyId, companyId), isNull(notifications.readAt)];
    if (options.role === "employee" && options.userId && !options.isSuperadmin) {
      conditions.push(or(eq(notifications.userId, options.userId), isNull(notifications.userId))!);
    }
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(...conditions));
    return Number(result[0]?.count ?? 0);
  }

  /**
   * Mark a single notification as read
   */
  public static async markAsRead(id: string, companyId: string) {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.companyId, companyId)));
  }

  /**
   * Mark all unread notifications as read
   */
  public static async markAllAsRead(companyId: string, userId?: string | null) {
    const conditions = [eq(notifications.companyId, companyId), isNull(notifications.readAt)];
    if (userId) {
      conditions.push(or(eq(notifications.userId, userId), isNull(notifications.userId))!);
    }
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(...conditions));
  }

  /**
   * Handle events and translate into notifications
   */
  public static async handleAppEvent(event: AppEvent) {
    switch (event.type) {
      case "booking.created": {
        const timeStr = event.startsAt instanceof Date
          ? event.startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          : "";
        const dateStr = event.startsAt instanceof Date
          ? event.startsAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
          : "";
        const proName = event.employeeName ? ` com ${event.employeeName}` : "";

        // General company notification (Owners, Admins, Receptionists)
        await this.createNotification({
          companyId: event.companyId,
          type: "booking.created",
          title: "Novo agendamento",
          body: `${event.customerName} agendou ${event.serviceName}${proName} para ${dateStr} às ${timeStr}.`,
          entityType: "appointment",
          entityId: event.appointmentId,
        });

        // If employee has a linked user account, create targeted notification
        if (event.employeeId) {
          const empUser = await db
            .select({ userId: employees.userId })
            .from(employees)
            .where(eq(employees.id, event.employeeId))
            .limit(1)
            .catch(() => []);

          if (empUser.length > 0 && empUser[0]?.userId) {
            await this.createNotification({
              companyId: event.companyId,
              userId: empUser[0].userId,
              type: "booking.created",
              title: "Novo cliente agendado com você",
              body: `${event.customerName} agendou ${event.serviceName} para ${dateStr} às ${timeStr}.`,
              entityType: "appointment",
              entityId: event.appointmentId,
            });
          }
        }
        break;
      }

      case "booking.rescheduled": {
        const newTime = event.newStartsAt instanceof Date
          ? event.newStartsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          : "";
        const newDate = event.newStartsAt instanceof Date
          ? event.newStartsAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
          : "";

        await this.createNotification({
          companyId: event.companyId,
          type: "booking.rescheduled",
          title: "Agendamento remarcado",
          body: `${event.customerName} remarcou ${event.serviceName} para ${newDate} às ${newTime}.`,
          entityType: "appointment",
          entityId: event.appointmentId,
        });
        break;
      }

      case "booking.cancelled": {
        const reason = event.reason ? ` Motivo: ${event.reason}` : "";
        await this.createNotification({
          companyId: event.companyId,
          type: "booking.cancelled",
          title: "Agendamento cancelado",
          body: `O agendamento de ${event.customerName} (${event.serviceName}) foi cancelado.${reason}`,
          entityType: "appointment",
          entityId: event.appointmentId,
        });
        break;
      }

      case "booking.completed": {
        await this.createNotification({
          companyId: event.companyId,
          type: "booking.completed",
          title: "Atendimento concluído",
          body: `${event.customerName} finalizado. Valor: R$ ${event.totalPrice}.`,
          entityType: "appointment",
          entityId: event.appointmentId,
        });
        break;
      }

      case "customer.arrived": {
        await this.createNotification({
          companyId: event.companyId,
          type: "customer.arrived",
          title: "Cliente na recepção",
          body: `${event.customerName} acabou de chegar para o atendimento.`,
          entityType: "appointment",
          entityId: event.appointmentId,
        });
        break;
      }

      case "payment.received": {
        await this.createNotification({
          companyId: event.companyId,
          type: "payment.received",
          title: "Pagamento registrado",
          body: `Recebimento de R$ ${event.amount} via ${event.method}.`,
          entityType: "financial",
          entityId: event.appointmentId,
        });
        break;
      }

      case "subscription.status_changed": {
        await this.createNotification({
          companyId: event.companyId,
          type: "subscription.status_changed",
          title: "Status do plano atualizado",
          body: `O plano da empresa agora está ${event.status} (${event.plan}).`,
          entityType: "subscription",
        });
        break;
      }

      case "system.alert": {
        if (event.companyId) {
          await this.createNotification({
            companyId: event.companyId,
            type: "system.alert",
            title: event.title,
            body: event.message,
            entityType: "system",
          });
        }
        break;
      }
    }
  }
}

// Wire EventBus to NotificationService handler
eventBus.onEvent("*", (event) => {
  void NotificationService.handleAppEvent(event);
});
