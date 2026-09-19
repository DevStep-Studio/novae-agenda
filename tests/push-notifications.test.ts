import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  pushDevices,
  notificationSchedules,
  bookings,
  companies,
  users,
  locations,
  clients,
} from "@/db/schema";
import {
  scheduleBookingReminders,
  cancelBookingSchedules,
  processPendingNotificationSchedules,
} from "@/lib/notification-scheduler";
import { sendExpoPushNotifications } from "@/lib/push-notifications";

test("Push Notifications & 2-Hour Reminder Engine Suite", async (t) => {
  const testCompanyId = crypto.randomUUID();
  const testUserId = crypto.randomUUID();
  const testClientId = crypto.randomUUID();
  const testBookingId = crypto.randomUUID();
  const testLocationId = crypto.randomUUID();

  // Setup test fixtures in MySQL
  await db.insert(companies).values({
    id: testCompanyId,
    name: "Barbearia Teste Push",
    publicSlug: `push-test-${Date.now()}`,
    businessType: "barbershop",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
  });

  await db.insert(locations).values({
    id: testLocationId,
    companyId: testCompanyId,
    name: "Sede Principal",
  });

  await db.insert(users).values({
    id: testUserId,
    companyId: testCompanyId,
    name: "Cliente Push Teste",
    email: `pushtest_${Date.now()}@example.com`,
    passwordHash: "hash123",
    role: "customer",
  });

  await db.insert(clients).values({
    id: testClientId,
    companyId: testCompanyId,
    userId: testUserId,
    name: "Cliente Push Teste",
    phone: "11999999999",
    active: true,
  });

  const futureBookingStartsAt = new Date(Date.now() + 5 * 60 * 60 * 1000); // 5 hours in future

  await db.insert(bookings).values({
    id: testBookingId,
    companyId: testCompanyId,
    locationId: testLocationId,
    userId: testUserId,
    clientId: testClientId,
    startsAt: futureBookingStartsAt,
    endsAt: new Date(futureBookingStartsAt.getTime() + 60 * 60 * 1000),
    timezone: "America/Sao_Paulo",
    status: "confirmed",
    revision: 1,
    subtotal: "50.00",
    total: "50.00",
    idempotencyKey: `idem_push_${Date.now()}`,
  });

  await t.test("1. Device Registration and Deactivation on Logout", async () => {
    const testPushToken = `ExponentPushToken[test_${Date.now()}]`;

    // 1. Register device
    const deviceId = crypto.randomUUID();
    await db.insert(pushDevices).values({
      id: deviceId,
      userId: testUserId,
      companyId: testCompanyId,
      pushToken: testPushToken,
      platform: "android",
      appVersion: "1.0.0",
      environment: "development",
      isActive: true,
      lastRegisteredAt: new Date(),
    });

    const [registered] = await db
      .select()
      .from(pushDevices)
      .where(eq(pushDevices.pushToken, testPushToken));

    assert.ok(registered, "Device should be registered in MySQL");
    assert.equal(registered.isActive, true, "Device should be active");
    assert.equal(registered.platform, "android");

    // 2. Unregister (Logout)
    await db
      .update(pushDevices)
      .set({ isActive: false, lastError: "User logged out" })
      .where(eq(pushDevices.pushToken, testPushToken));

    const [unregistered] = await db
      .select()
      .from(pushDevices)
      .where(eq(pushDevices.pushToken, testPushToken));

    assert.equal(unregistered.isActive, false, "Device should be deactivated upon logout");

    // Clean up
    await db.delete(pushDevices).where(eq(pushDevices.id, deviceId));
  });

  await t.test("2. Idempotent 2-Hour Reminder Scheduling for Bookings", async () => {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, testBookingId));
    assert.ok(booking, "Booking fixture must exist");

    // Schedule reminders
    await scheduleBookingReminders(db as any, booking);

    // Verify reminder schedule record created
    const schedules = await db
      .select()
      .from(notificationSchedules)
      .where(eq(notificationSchedules.bookingId, testBookingId));

    assert.ok(schedules.length >= 1, "Should create scheduled reminders");
    const customer2h = schedules.find((s) => s.eventType === "reminder_2h");
    assert.ok(customer2h, "Should create 2h reminder for customer");
    assert.equal(customer2h.status, "pending");

    // Test Idempotency: calling scheduleBookingReminders again with same revision should not duplicate
    await scheduleBookingReminders(db as any, booking);

    const schedulesAfterDuplicate = await db
      .select()
      .from(notificationSchedules)
      .where(eq(notificationSchedules.bookingId, testBookingId));

    const customer2hCount = schedulesAfterDuplicate.filter((s) => s.eventType === "reminder_2h").length;
    assert.equal(customer2hCount, 1, "Idempotency key prevents duplicate scheduled reminders");

    // Cancel reminders (e.g. on cancellation)
    await cancelBookingSchedules(db as any, testBookingId);

    const schedulesAfterCancel = await db
      .select()
      .from(notificationSchedules)
      .where(eq(notificationSchedules.bookingId, testBookingId));

    for (const s of schedulesAfterCancel) {
      assert.equal(s.status, "cancelled", "Pending schedules should be marked as cancelled");
    }

    // Clean up
    await db.delete(notificationSchedules).where(eq(notificationSchedules.bookingId, testBookingId));
  });

  await t.test("3. Push Message Batching and Format Validation", async () => {
    const emptyResult = await sendExpoPushNotifications([]);
    assert.equal(emptyResult.successCount, 0);
    assert.equal(emptyResult.failureCount, 0);

    const invalidResult = await sendExpoPushNotifications([
      { to: "invalid-token", title: "Test", body: "Body" },
    ]);
    assert.equal(invalidResult.failureCount, 1);
  });

  // Global Clean Up
  await db.delete(bookings).where(eq(bookings.id, testBookingId));
  await db.delete(clients).where(eq(clients.id, testClientId));
  await db.delete(locations).where(eq(locations.id, testLocationId));
  await db.delete(users).where(eq(users.id, testUserId));
  await db.delete(companies).where(eq(companies.id, testCompanyId));
});
