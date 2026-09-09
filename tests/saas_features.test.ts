import "dotenv/config";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "@/db";
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
    const [comp] = await db
      .insert(companies)
      .values({
        name: "SaaS Studio Test",
        publicSlug: `test-slug-${Date.now()}`,
      })
      .returning();
    testCompanyId = comp.id;

    // 2. Create user (cross-tenant client has companyId: null)
    const [usr] = await db
      .insert(users)
      .values({
        companyId: null,
        name: "Cliente Waitlist",
        email: `client-waitlist-${Date.now()}@example.com`,
        passwordHash: "$2a$10$dummyHashForTestingPurposesOnlyXXXXXXXXXXXX",
        role: "client",
      })
      .returning();
    testUserId = usr.id;

    // 3. Create location
    const [loc] = await db
      .insert(locations)
      .values({
        companyId: testCompanyId,
        name: "Unidade Central",
        openTime: "08:00",
        closeTime: "18:00",
      })
      .returning();
    testLocationId = loc.id;

    // 4. Create employee
    const [emp] = await db
      .insert(employees)
      .values({
        companyId: testCompanyId,
        name: "Profissional Alpha",
        commissionType: "percentage",
        commissionValue: "40.00",
      })
      .returning();
    testEmployeeId = emp.id;

    // 5. Create service
    const [srv] = await db
      .insert(services)
      .values({
        companyId: testCompanyId,
        name: "Corte & Barba Premium",
        price: "120.00",
        durationMinutes: 45,
      })
      .returning();
    testServiceId = srv.id;

    // 6. Create client
    const [cli] = await db
      .insert(clients)
      .values({
        companyId: testCompanyId,
        name: "Cliente Fidelidade",
        phone: "11999998888",
        email: "cliente.fidelidade@example.com",
      })
      .returning();
    testClientId = cli.id;

    // 7. Create completed appointment for review tests
    const [apt] = await db
      .insert(appointments)
      .values({
        companyId: testCompanyId,
        locationId: testLocationId,
        employeeId: testEmployeeId,
        clientId: testClientId,
        appointmentDate: "2026-03-01",
        startTime: "10:00",
        endTime: "10:45",
        total: "120.00",
        status: "completed",
      })
      .returning();
    testAppointmentId = apt.id;
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
      const [rev] = await db
        .insert(reviews)
        .values({
          companyId: testCompanyId,
          appointmentId: testAppointmentId,
          clientId: testClientId,
          employeeId: testEmployeeId,
          serviceId: testServiceId,
          rating: 5,
          comment: "Excelente atendimento, corte impecável!",
          status: "approved",
        })
        .returning();

      assert.ok(rev);
      assert.equal(rev.rating, 5);
      assert.equal(rev.comment, "Excelente atendimento, corte impecável!");
      assert.equal(rev.appointmentId, testAppointmentId);
    });

    it("should enforce single review per appointment constraint", async () => {
      let threw = false;
      try {
        await db.insert(reviews).values({
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
      const [entry] = await db
        .insert(bookingWaitlist)
        .values({
          companyId: testCompanyId,
          userId: testUserId,
          requestedDate: "2026-03-15",
          serviceIds: [testServiceId],
          status: "waiting",
        })
        .returning();

      assert.ok(entry);
      assert.equal(entry.status, "waiting");

      // Insert corresponding notification
      const [notif] = await db
        .insert(notifications)
        .values({
          companyId: testCompanyId,
          type: "waitlist_entry",
          title: "Novo cliente na lista de espera",
          body: `Cliente entrou na lista de espera para 15/03/2026.`,
          entityType: "waitlist",
          entityId: entry.id,
        })
        .returning();

      assert.ok(notif);
      assert.equal(notif.type, "waitlist_entry");
      assert.equal(notif.companyId, testCompanyId);
    });
  });
});
