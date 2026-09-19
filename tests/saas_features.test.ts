import "dotenv/config";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  companies,
  subscriptions,
  subscriptionInvoices,
  reviews,
  appointments,
  clients,
  employees,
  locations,
  services,
  notifications,
  bookingWaitlist,
  users,
} from "@/db/schema";
import {
  getCompanySubscription,
  assertSubscriptionActive,
  PLANS,
} from "@/lib/subscriptions";
import { createSubscriptionCheckout, activateSubscription } from "@/lib/mercadopago";
import { PlanFeatureService } from "@/lib/subscriptions/features";
import { WhatsAppMessagingProvider, EmailMessagingProvider } from "@/lib/messaging/provider";
import { getCompanySettings, setCompanySetting } from "@/lib/settings";

describe("SaaS Commercial Engine, Subscriptions & Reviews", () => {
  let testCompanyId: string;
  let testLocationId: string;
  let testEmployeeId: string;
  let testServiceId: string;
  let testClientId: string;
  let testUserId: string;
  let testAppointmentId: string;

  before(async () => {
    // 1. Create a test company
    testCompanyId = crypto.randomUUID();
    await db
      .insert(companies)
      .values({
        id: testCompanyId,
        name: "SaaS Studio Test",
        publicSlug: `test-slug-${Date.now()}`,
      });

    // 2. Create user (cross-tenant client has companyId: null)
    testUserId = crypto.randomUUID();
    await db
      .insert(users)
      .values({
        id: testUserId,
        companyId: null,
        name: "Cliente Waitlist",
        email: `client-waitlist-${Date.now()}@example.com`,
        passwordHash: "$2a$10$dummyHashForTestingPurposesOnlyXXXXXXXXXXXX",
        role: "customer",
      });

    // 3. Create location
    testLocationId = crypto.randomUUID();
    await db
      .insert(locations)
      .values({
        id: testLocationId,
        companyId: testCompanyId,
        name: "Unidade Central",
        openTime: "08:00",
        closeTime: "18:00",
      });

    // 4. Create employee
    testEmployeeId = crypto.randomUUID();
    await db
      .insert(employees)
      .values({
        id: testEmployeeId,
        companyId: testCompanyId,
        name: "Profissional Alpha",
        commissionType: "percentage",
        commissionValue: "40.00",
      });

    // 5. Create service
    testServiceId = crypto.randomUUID();
    await db
      .insert(services)
      .values({
        id: testServiceId,
        companyId: testCompanyId,
        name: "Corte & Barba Premium",
        price: "120.00",
        durationMinutes: 45,
      });

    // 6. Create client
    testClientId = crypto.randomUUID();
    await db
      .insert(clients)
      .values({
        id: testClientId,
        companyId: testCompanyId,
        name: "Cliente Fidelidade",
        phone: "11999998888",
        email: "cliente.fidelidade@example.com",
      });

    // 7. Create completed appointment for review tests
    testAppointmentId = crypto.randomUUID();
    await db
      .insert(appointments)
      .values({
        id: testAppointmentId,
        companyId: testCompanyId,
        locationId: testLocationId,
        employeeId: testEmployeeId,
        clientId: testClientId,
        appointmentDate: "2026-03-01",
        startTime: "10:00",
        endTime: "10:45",
        total: "120.00",
        status: "completed",
      });
  });

  after(async () => {
    // Cleanup test data safely
    if (testCompanyId) {
      await db.delete(reviews).where(eq(reviews.companyId, testCompanyId)).catch(() => {});
      await db.delete(appointments).where(eq(appointments.companyId, testCompanyId)).catch(() => {});
      await db.delete(bookingWaitlist).where(eq(bookingWaitlist.companyId, testCompanyId)).catch(() => {});
      await db.delete(notifications).where(eq(notifications.companyId, testCompanyId)).catch(() => {});
      await db.delete(subscriptionInvoices).where(eq(subscriptionInvoices.companyId, testCompanyId)).catch(() => {});
      await db.delete(subscriptions).where(eq(subscriptions.companyId, testCompanyId)).catch(() => {});
      await db.delete(clients).where(eq(clients.companyId, testCompanyId)).catch(() => {});
      await db.delete(services).where(eq(services.companyId, testCompanyId)).catch(() => {});
      await db.delete(employees).where(eq(employees.companyId, testCompanyId)).catch(() => {});
      await db.delete(locations).where(eq(locations.companyId, testCompanyId)).catch(() => {});
      await db.delete(users).where(eq(users.id, testUserId)).catch(() => {});
      await db.delete(companies).where(eq(companies.id, testCompanyId)).catch(() => {});
    }
    await pool.end();
  });

  describe("1. Subscription Lifecycle & Paywall Engine", () => {
    it("should provision a 7-day TRIAL subscription by default for new company", async () => {
      const sub = await getCompanySubscription(testCompanyId);
      assert.ok(sub);
      assert.equal(sub.plan, "trial");
      assert.equal(sub.status, "trialing");
      assert.ok(sub.trialEndsAt);

      const daysLeft = Math.ceil(
        (new Date(sub.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      assert.ok(daysLeft >= 6 && daysLeft <= 7, `Expected around 7 days, got ${daysLeft}`);

      // assertSubscriptionActive should pass for active trial
      const check = await assertSubscriptionActive(testCompanyId);
      assert.equal(check.ok, true);
    });

    it("should reject operations when subscription has expired", async () => {
      // Simulate expired trial in past
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await db
        .update(subscriptions)
        .set({
          status: "expired",
          trialEndsAt: pastDate,
          currentPeriodEnd: pastDate,
        })
        .where(eq(subscriptions.companyId, testCompanyId));

      const check = await assertSubscriptionActive(testCompanyId);
      assert.equal(check.ok, false);
      assert.equal(check.status, "expired");
      assert.ok(check.reason?.includes("expirou"));
    });

    it("should generate a valid checkout URL with Mercado Pago integration", async () => {
      const checkout = await createSubscriptionCheckout({
        companyId: testCompanyId,
        companyName: "SaaS Studio Test",
        planKey: "pro_monthly",
        payerEmail: "proprietario@teste.com",
        payerName: "Proprietário Teste",
        backUrl: "http://localhost:3000/gestao",
      });

      assert.ok(checkout.initPoint, "Must have an initPoint URL");
      assert.ok(typeof checkout.isSimulated === "boolean");
    });

    it("should activate subscription and record invoice on payment confirmation", async () => {
      await activateSubscription(testCompanyId, "pro_monthly", "pay_test_123", 89.9);

      // Verify DB state
      const sub = await getCompanySubscription(testCompanyId);
      assert.equal(sub.plan, "pro_monthly");
      assert.equal(sub.status, "active");
      assert.ok(sub.currentPeriodEnd);

      // Verify invoice created
      const invoices = await db
        .select()
        .from(subscriptionInvoices)
        .where(eq(subscriptionInvoices.companyId, testCompanyId));

      assert.ok(invoices.length > 0);
      assert.equal(Number(invoices[0].amount), 89.9);
      assert.equal(invoices[0].status, "paid");

      // Verify subscription is allowed
      const check = await assertSubscriptionActive(testCompanyId);
      assert.equal(check.ok, true);
    });
  });

  describe("2. Client Reviews & Feedback System", () => {
    it("should create a verified review for a completed appointment", async () => {
      const reviewId = crypto.randomUUID();
      await db
        .insert(reviews)
        .values({
          id: reviewId,
          companyId: testCompanyId,
          appointmentId: testAppointmentId,
          clientId: testClientId,
          employeeId: testEmployeeId,
          serviceId: testServiceId,
          rating: 5,
          comment: "Excelente atendimento, corte impecável!",
          status: "approved",
        });

      const [rev] = await db.select().from(reviews).where(eq(reviews.id, reviewId));
      assert.ok(rev);
      assert.equal(rev.rating, 5);
      assert.equal(rev.comment, "Excelente atendimento, corte impecável!");
      assert.equal(rev.appointmentId, testAppointmentId);
    });

    it("should enforce single review per appointment constraint", async () => {
      let threw = false;
      try {
        await db.insert(reviews).values({
          id: crypto.randomUUID(),
          companyId: testCompanyId,
          appointmentId: testAppointmentId,
          clientId: testClientId,
          employeeId: testEmployeeId,
          serviceId: testServiceId,
          rating: 4,
        });
      } catch {
        threw = true;
      }
      assert.equal(threw, true, "Should have thrown a duplicate key error");
    });
  });

  describe("3. Waitlist & Real-Time Owner Notification", () => {
    it("should register client in waitlist and create notification for owner", async () => {
      const entryId = crypto.randomUUID();
      await db
        .insert(bookingWaitlist)
        .values({
          id: entryId,
          companyId: testCompanyId,
          userId: testUserId,
          requestedDate: "2026-03-15",
          serviceIds: [testServiceId],
          status: "waiting",
        });

      const [entry] = await db.select().from(bookingWaitlist).where(eq(bookingWaitlist.id, entryId));
      assert.ok(entry);
      assert.equal(entry.status, "waiting");

      // Insert corresponding notification
      const notifId = crypto.randomUUID();
      await db
        .insert(notifications)
        .values({
          id: notifId,
          companyId: testCompanyId,
          type: "waitlist_entry",
          title: "Novo cliente na lista de espera",
          body: `Cliente entrou na lista de espera para 15/03/2026.`,
          entityType: "waitlist",
          entityId: entry.id,
        });

      const [notif] = await db.select().from(notifications).where(eq(notifications.id, notifId));
      assert.ok(notif);
      assert.equal(notif.type, "waitlist_entry");
      assert.equal(notif.companyId, testCompanyId);
    });
  });

  describe("4. Commercial SaaS Features: Plan Limits, Advanced Settings & Messaging", () => {
    it("should enforce PlanFeatureService professional and location quotas", () => {
      // Trial
      const trialCheck1 = PlanFeatureService.canAddProfessional(2, "trial");
      assert.equal(trialCheck1.allowed, true);
      const trialCheck2 = PlanFeatureService.canAddProfessional(3, "trial");
      assert.equal(trialCheck2.allowed, false);
      assert.equal(trialCheck2.limit, 3);

      // Pro Monthly
      const proCheck = PlanFeatureService.canAddProfessional(4, "pro_monthly");
      assert.equal(proCheck.allowed, true);
      const proCheckLimit = PlanFeatureService.canAddProfessional(5, "pro_monthly");
      assert.equal(proCheckLimit.allowed, false);

      // Capabilities
      assert.equal(PlanFeatureService.hasCapability("trial", "customBranding"), false);
      assert.equal(PlanFeatureService.hasCapability("pro_monthly", "customBranding"), true);
      assert.equal(PlanFeatureService.hasCapability("trial", "waitingList"), true);
    });

    it("should store and retrieve advanced booking rules in companySettings", async () => {
      await setCompanySetting(testCompanyId, "minLeadMinutes", 120);
      await setCompanySetting(testCompanyId, "cancellationHours", 12);
      await setCompanySetting(testCompanyId, "rescheduleHours", 6);
      await setCompanySetting(testCompanyId, "dailyBookingLimit", 10);
      await setCompanySetting(testCompanyId, "allowHolidayBookings", "true");

      const loaded = await getCompanySettings(testCompanyId);
      assert.equal(loaded.minLeadMinutes, 120);
      assert.equal(loaded.cancellationHours, 12);
      assert.equal(loaded.rescheduleHours, 6);
      assert.equal(loaded.dailyBookingLimit, 10);
      assert.equal(loaded.allowHolidayBookings, true);
    });

    it("should format WhatsApp confirmation link correctly", async () => {
      const waProvider = new WhatsAppMessagingProvider();
      const res = await waProvider.sendBookingConfirmation({
        customerName: "Maria Silva",
        customerPhone: "(11) 99999-8888",
        companyName: "Studio Reservei",
        serviceName: "Corte e Escova",
        date: "2026-03-20",
        time: "14:00",
        bookingId: "dummy-id",
      });

      assert.equal(res.ok, true);
      assert.equal(res.channel, "whatsapp");
      assert.ok(res.deepLink?.startsWith("https://wa.me/5511999998888"));
      assert.ok(res.deepLink?.includes("Studio%20Reservei"));
      assert.ok(res.deepLink?.includes("Corte%20e%20Escova"));
    });

    it("should generate email confirmation message payload correctly", async () => {
      const emailProvider = new EmailMessagingProvider();
      const res = await emailProvider.sendBookingConfirmation({
        customerName: "Lucas Costa",
        customerEmail: "lucas@example.com",
        companyName: "Barbearia Reservei",
        serviceName: "Barba e Cabelo",
        date: "2026-03-22",
        time: "10:30",
        bookingId: "dummy-id-2",
      });

      assert.equal(res.ok, true);
      assert.equal(res.channel, "email");
    });
  });
});

