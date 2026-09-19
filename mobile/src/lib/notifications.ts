import { api } from "./api-client";

export type NotificationDTO = {
  id: string;
  type: string;
  category?: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  entityType?: string | null;
  entityId?: string | null;
};

export type NotificationsResponse = {
  notifications: NotificationDTO[];
  total: number;
  unreadCount: number;
};

export async function getNotifications(category = "all", limit = 50) {
  return api<NotificationsResponse>(`/api/notifications?category=${category}&limit=${limit}`);
}

export async function markAllNotificationsAsRead() {
  return api<{ ok: boolean }>("/api/notifications", {
    method: "POST",
  });
}
