import { api } from "./api-client";

export type NotificationCategory = "all" | "unread" | "agendamentos" | "financeiro" | "sistema";

export type NotificationDTO = {
  id: string;
  type: string;
  title: string;
  body: string;
  /** Null when unread, ISO timestamp of when it was read otherwise — matches `src/lib/notifications/service.ts`'s real response shape (there is no `read` boolean field). */
  readAt: string | null;
  createdAt: string;
  entityType?: string | null;
  entityId?: string | null;
};

export type NotificationsResponse = {
  notifications: NotificationDTO[];
  total: number;
  unreadCount: number;
};

export async function getNotifications(category: NotificationCategory = "all", limit = 50) {
  return api<NotificationsResponse>(`/api/notifications?category=${category}&limit=${limit}`);
}

export async function markAllNotificationsAsRead() {
  return api<{ ok: boolean }>("/api/notifications", {
    method: "POST",
  });
}

export async function markNotificationRead(id: string) {
  return api<{ ok: boolean }>(`/api/notifications/${id}/read`, {
    method: "PATCH",
  });
}

export async function simulateNotification(
  type: "reminder_2h" | "new_booking" | "cancellation" | "payment" = "reminder_2h"
) {
  return api<{ ok: boolean }>("/api/notifications/simulate", {
    method: "POST",
    body: JSON.stringify({ type }),
  });
}
