import "dotenv/config";
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { companies, notifications, users } from "@/db/schema";
import { NotificationService } from "@/lib/notifications/service";
import { eventBus } from "@/lib/notifications/event-bus";

describe("Central de Notificações - Service & EventBus", () => {
  const testCompanyId = randomUUID();
  const testUserId = randomUUID();

  it("should create notification and query unread count", async () => {
    // Setup company
    await db.insert(companies).values({
      id: testCompanyId,
      name: "Empresa Notificações QA",
      timezone: "America/Sao_Paulo",
      currency: "BRL",
      primaryColor: "#dcff4c",
      secondaryColor: "#111111",
      publicPhotos: [],
    });

    const notifId = await NotificationService.createNotification({
      companyId: testCompanyId,
      type: "booking.created",
      title: "Novo Agendamento Confirmado",
      body: "Cliente Maria agendou Manicure para amanhã às 14:00.",
      entityType: "appointment",
      entityId: randomUUID(),
    });

    assert.ok(notifId, "Notification ID should be returned");

    const unread = await NotificationService.getUnreadCount(testCompanyId);
    assert.ok(unread >= 1, "Unread count should be at least 1");

    // Fetch notifications
    const res = await NotificationService.getNotifications(testCompanyId, {
      category: "agendamentos",
    });

    assert.ok(res.notifications.length >= 1, "Should return at least 1 appointment notification");
    const found = res.notifications.find((n) => n.id === notifId);
    assert.ok(found, "Created notification should be present in results");
    assert.equal(found.title, "Novo Agendamento Confirmado");
    assert.equal(found.readAt, null);

    // Mark single as read
    await NotificationService.markAsRead(notifId, testCompanyId);

    const unreadAfter = await NotificationService.getUnreadCount(testCompanyId);
    assert.equal(unreadAfter, unread - 1, "Unread count should decrease after marking as read");
  });

  it("should filter by categories: financeiro, agendamentos, sistema", async () => {
    // Insert financial notification
    await NotificationService.createNotification({
      companyId: testCompanyId,
      type: "payment.received",
      title: "Pagamento Aprovado",
      body: "Recebido R$ 120,00 via PIX.",
      entityType: "financial",
    });

    // Insert system notification
    await NotificationService.createNotification({
      companyId: testCompanyId,
      type: "system.alert",
      title: "Atualização de Segurança",
      body: "Backup automático concluído com sucesso.",
      entityType: "system",
    });

    const financialRes = await NotificationService.getNotifications(testCompanyId, {
      category: "financeiro",
    });
    assert.ok(financialRes.notifications.some((n) => n.type === "payment.received"));
    assert.ok(!financialRes.notifications.some((n) => n.type === "system.alert"));

    const systemRes = await NotificationService.getNotifications(testCompanyId, {
      category: "sistema",
    });
    assert.ok(systemRes.notifications.some((n) => n.type === "system.alert"));
    assert.ok(!systemRes.notifications.some((n) => n.type === "payment.received"));
  });

  it("should mark all notifications as read", async () => {
    await NotificationService.markAllAsRead(testCompanyId);
    const unread = await NotificationService.getUnreadCount(testCompanyId);
    assert.equal(unread, 0, "All notifications should be marked as read");

    // Clean up
    await db.delete(notifications).where(eq(notifications.companyId, testCompanyId)).catch(() => {});
    await db.delete(companies).where(eq(companies.id, testCompanyId)).catch(() => {});
  });

  after(async () => {
    await pool.end();
  });
});
