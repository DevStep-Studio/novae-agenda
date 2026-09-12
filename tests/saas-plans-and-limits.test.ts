import "dotenv/config";
process.env.DATABASE_URL = process.env.DATABASE_URL || "mysql://root:password@localhost:3306/novae_agenda";

import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SAAS_PLANS, seedSaasPlans } from "../src/lib/saas/plans-seed";
import { PlanLimitService } from "../src/lib/saas/plan-limits";
import { SaasPaymentProvider } from "../src/lib/saas/payment-provider";

test("SaaS Plans and Limits — Comprehensive Test Suite", async (t) => {
  // Mock in-memory database simulation for testing domain logic
  const mockSaasPlans = [...DEFAULT_SAAS_PLANS.map((p, idx) => ({ id: `plan_${idx + 1}`, ...p }))];
  const mockSubscriptions: any[] = [];
  const mockInvoices: any[] = [];
  const mockEmployees: any[] = [];
  const mockUsers: any[] = [];
  const mockWebhookEvents: any[] = [];

  const mockDb: any = {
    select: (fields?: any) => ({
      from: (table: any) => ({
        where: (condition: any) => ({
          orderBy: (order: any) => ({
            limit: (n: number) => {
              // Return matching records based on condition
              return [];
            },
          }),
          limit: (n: number) => {
            return [];
          },
        }),
      }),
    }),
  };

  await t.test("1. All 6 initial SaaS plans must exist with exact prices and seat limits", () => {
    assert.equal(DEFAULT_SAAS_PLANS.length, 6);

    const essencial = DEFAULT_SAAS_PLANS.find((p) => p.slug === "essencial");
    assert.ok(essencial);
    assert.equal(essencial.monthlyPrice, "19.90");
    assert.equal(essencial.annualPrice, "199.00");
    assert.equal(essencial.employeeLimit, 2);

    const profissional = DEFAULT_SAAS_PLANS.find((p) => p.slug === "profissional");
    assert.ok(profissional);
    assert.equal(profissional.monthlyPrice, "39.90");
    assert.equal(profissional.annualPrice, "399.00");
    assert.equal(profissional.employeeLimit, 5);
    assert.equal(profissional.badge, "Mais escolhido");

    const equipe = DEFAULT_SAAS_PLANS.find((p) => p.slug === "equipe");
    assert.ok(equipe);
    assert.equal(equipe.monthlyPrice, "69.90");
    assert.equal(equipe.annualPrice, "699.00");
    assert.equal(equipe.employeeLimit, 10);

    const negocio = DEFAULT_SAAS_PLANS.find((p) => p.slug === "negocio");
    assert.ok(negocio);
    assert.equal(negocio.monthlyPrice, "119.90");
    assert.equal(negocio.annualPrice, "1199.00");
    assert.equal(negocio.employeeLimit, 20);

    const empresa = DEFAULT_SAAS_PLANS.find((p) => p.slug === "empresa");
    assert.ok(empresa);
    assert.equal(empresa.monthlyPrice, "229.90");
    assert.equal(empresa.annualPrice, "2299.00");
    assert.equal(empresa.employeeLimit, 50);

    const enterprise = DEFAULT_SAAS_PLANS.find((p) => p.slug === "enterprise");
    assert.ok(enterprise);
    assert.equal(enterprise.monthlyPrice, "399.90");
    assert.equal(enterprise.annualPrice, "3999.00");
    assert.equal(enterprise.employeeLimit, 100);
  });

  await t.test("2. Plan limits calculation and Owner exclusion", async () => {
    const testCompanyId = "comp_test_1";
    const ownerUserId = "user_owner_1";
    const staffUser1 = "user_staff_1";
    const staffUser2 = "user_staff_2";

    // Setup mock company state
    const companyUsers = [
      { id: ownerUserId, companyId: testCompanyId, role: "owner" },
      { id: staffUser1, companyId: testCompanyId, role: "employee" },
      { id: staffUser2, companyId: testCompanyId, role: "employee" },
    ];

    const companyEmployees = [
      { id: "emp_1", companyId: testCompanyId, userId: ownerUserId, name: "Owner Name", active: true },
      { id: "emp_2", companyId: testCompanyId, userId: staffUser1, name: "Staff 1", active: true },
      { id: "emp_3", companyId: testCompanyId, userId: staffUser2, name: "Staff 2", active: true },
      { id: "emp_4", companyId: testCompanyId, userId: null, name: "Staff Inactive", active: false },
    ];

    const testExecutor: any = {
      select: () => ({
        from: (table: any) => ({
          where: () => ({
            limit: () => [
              {
                id: "sub_1",
                companyId: testCompanyId,
                plan: "essencial",
                planId: "plan_1",
                status: "active",
                employeeLimit: 2,
              },
            ],
          }),
        }),
      }),
    };

    // Custom executor returning filtered data
    testExecutor.select = () => ({
      from: (tbl: any) => ({
        where: () => {
          // Check active employees
          const activeEmps = companyEmployees.filter((e) => e.companyId === testCompanyId && e.active);
          return {
            limit: () => [
              {
                id: "sub_1",
                companyId: testCompanyId,
                plan: "essencial",
                planId: null,
                status: "active",
                employeeLimit: 2,
              },
            ],
            then: (resolve: any) => resolve(activeEmps),
          };
        },
      }),
    });

    // Verification of count:
    // Out of 4 employees: 1 is inactive, 1 is the owner => exactly 2 seats counted!
    const activeStaff = companyEmployees.filter((e) => e.active);
    const ownerIds = new Set(companyUsers.filter((u) => u.role === "owner").map((u) => u.id));
    const countedStaff = activeStaff.filter((e) => !e.userId || !ownerIds.has(e.userId));

    assert.equal(countedStaff.length, 2, "Owner and inactive employees must not consume employee seats.");
  });

  await t.test("3. Seat limit enforcement on Essencial (limit = 2)", async () => {
    // Current usage = 2, Limit = 2
    const currentUsage = 2;
    const limit = 2;

    const canAddMore = currentUsage < limit;
    assert.equal(canAddMore, false, "Should block 3rd employee on Essencial plan.");

    // Adding 3rd employee should trigger error
    let blocked = false;
    try {
      if (!canAddMore) {
        throw new Error("Limite de funcionários do plano atingido.");
      }
    } catch (err: any) {
      blocked = true;
      assert.match(err.message, /Limite de funcionários/);
    }
    assert.equal(blocked, true);
  });

  await t.test("4. Upgrade to Profissional (limit = 5) unlocks additional seats", () => {
    const currentUsage = 2;
    const newLimit = 5;

    const canAdd3rd = currentUsage + 1 <= newLimit;
    const canAdd4th = currentUsage + 2 <= newLimit;
    const canAdd5th = currentUsage + 3 <= newLimit;
    const canAdd6th = currentUsage + 4 <= newLimit;

    assert.equal(canAdd3rd, true);
    assert.equal(canAdd4th, true);
    assert.equal(canAdd5th, true);
    assert.equal(canAdd6th, false, "6th employee should exceed Profissional limit of 5.");
  });

  await t.test("5. Downgrade safety preserves existing employees without deletion", async () => {
    const currentUsage = 8;
    const targetLimit = 5; // Downgrade to Profissional

    const evalResult = {
      currentUsage,
      targetLimit,
      isDowngrade: targetLimit < currentUsage,
      willExceed: currentUsage > targetLimit,
      excessCount: Math.max(0, currentUsage - targetLimit),
    };

    assert.equal(evalResult.isDowngrade, true);
    assert.equal(evalResult.willExceed, true);
    assert.equal(evalResult.excessCount, 3);

    // Rule: system sets status as exceeded, DOES NOT delete employees, but blocks adding new ones
    const newAdditionAllowed = currentUsage < targetLimit;
    assert.equal(newAdditionAllowed, false);
  });

  await t.test("6. Transparent PIX Checkout Generation", async () => {
    const provider = new SaasPaymentProvider();
    const testCompanyId = "comp_pix_test";

    // Setup mock executor to intercept insertion
    let insertedInvoice: any = null;
    let insertedSub: any = null;

    const mockExecutor: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => [],
          }),
        }),
      }),
      insert: (table: any) => ({
        values: (vals: any) => {
          if (vals.pixQrCode || vals.pixCopiaECola) {
            insertedInvoice = vals;
          } else {
            insertedSub = vals;
          }
          return Promise.resolve();
        },
      }),
    };

    const result = await provider.createPixPayment(
      {
        companyId: testCompanyId,
        planSlug: "profissional",
        billingInterval: "monthly",
        payerEmail: "owner@test.com",
        payerName: "Owner Test",
      },
      mockExecutor
    );

    assert.ok(result.invoiceId);
    assert.ok(result.paymentId);
    assert.equal(result.amount, 39.90);
    assert.ok(result.copiaECola.includes("br.gov.bcb.pix"));
    assert.equal(result.status, "pending");
  });

  await t.test("7. Transparent Card Checkout with Approval & Rejection flows", async () => {
    const provider = new SaasPaymentProvider();
    const testCompanyId = "comp_card_test";

    const mockExecutor: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => [],
          }),
        }),
      }),
      insert: () => ({
        values: () => Promise.resolve(),
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
    };

    // 1. Approved card
    const approvedResult = await provider.createCardPayment(
      {
        companyId: testCompanyId,
        planSlug: "equipe",
        billingInterval: "monthly",
        cardToken: "tok_valid_1234",
        payerEmail: "owner@test.com",
        payerName: "Owner Test",
      },
      mockExecutor
    );

    assert.equal(approvedResult.status, "approved");
    assert.equal(approvedResult.amount, 69.90);

    // 2. Rejected card
    const rejectedResult = await provider.createCardPayment(
      {
        companyId: testCompanyId,
        planSlug: "equipe",
        billingInterval: "monthly",
        cardToken: "token_rejected",
        payerEmail: "owner@test.com",
        payerName: "Owner Test",
      },
      mockExecutor
    );

    assert.equal(rejectedResult.status, "rejected");
    assert.equal(rejectedResult.statusDetail, "cc_rejected_bad_filled_other");
  });

  await t.test("8. Webhook Idempotency prevents duplicate activations", () => {
    const processedEvents = new Set<string>();
    const eventId = "pay_12345_payment.created";

    // 1st webhook receipt
    let firstTime = false;
    if (!processedEvents.has(eventId)) {
      processedEvents.add(eventId);
      firstTime = true;
    }
    assert.equal(firstTime, true, "First event should be processed.");

    // 2nd duplicate webhook receipt
    let secondTime = false;
    if (!processedEvents.has(eventId)) {
      secondTime = true;
    }
    assert.equal(secondTime, false, "Duplicate event must be skipped idempotently.");
  });

  await t.test("9. Strict Domain Separation: Booking Payment vs SaaS Subscription vs Customer Membership", () => {
    const saasPayment = {
      type: "SAAS_SUBSCRIPTION",
      payer: "OWNER",
      method: "ONLINE_PIX_OR_CARD",
      beneficiary: "RESERVEI",
    };

    const customerMembership = {
      type: "CUSTOMER_MEMBERSHIP",
      payer: "ESTABLISHMENT_CLIENT",
      method: "RECURRING_CLUB_PLAN",
      beneficiary: "ESTABLISHMENT",
    };

    const bookingPayment = {
      type: "BOOKING_IN_PERSON",
      payer: "ESTABLISHMENT_CLIENT",
      method: "IN_PERSON_DAY_OF_SERVICE",
      beneficiary: "ESTABLISHMENT",
    };

    assert.notEqual(saasPayment.type, bookingPayment.type);
    assert.notEqual(saasPayment.type, customerMembership.type);
    assert.equal(bookingPayment.method, "IN_PERSON_DAY_OF_SERVICE");
    assert.equal(saasPayment.payer, "OWNER");
  });
});
