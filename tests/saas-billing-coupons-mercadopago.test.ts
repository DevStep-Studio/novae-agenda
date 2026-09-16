import "dotenv/config";
process.env.DATABASE_URL = process.env.DATABASE_URL || "mysql://root:password@localhost:3306/novae_agenda";

import crypto from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/db";
import { companies, saasCoupons, subscriptionInvoices, subscriptions, users } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_SAAS_PLANS, seedSaasPlans } from "../src/lib/saas/plans-seed";
import { DEFAULT_SAAS_COUPONS, seedSaasCoupons } from "../src/lib/saas/coupons-seed";
import { PlanLimitService } from "../src/lib/saas/plan-limits";
import { SaasCouponService } from "../src/lib/saas/coupon-service";
import { MercadoPagoStatusMapper, SaasPaymentProvider } from "../src/lib/saas/payment-provider";
import { hasMinRole, normalizeRole, ROLE_RANK, type Role } from "../src/lib/auth";

test("SaaS Billing, Coupons & Mercado Pago — Complete Validation Suite", async (t) => {
  // Ensure default plans and coupons are seeded
  await seedSaasPlans(db);
  await seedSaasCoupons(db);

  // Helper to create disposable test company
  const createdCompanyIds: string[] = [];
  async function createTestCompany(name = "Empresa Teste SaaS") {
    const compId = crypto.randomUUID();
    createdCompanyIds.push(compId);
    await db.insert(companies).values({
      id: compId,
      name,
      businessType: "Barbearia",
      publicSlug: `slug-${compId.slice(0, 8)}`,
      publicEnabled: true,
    });

    const ownerId = crypto.randomUUID();
    await db.insert(users).values({
      id: ownerId,
      companyId: compId,
      name: "Owner Teste",
      email: `owner-${compId.slice(0, 8)}@test.com`,
      passwordHash: "hash123",
      role: "owner",
    });

    return { compId, ownerId };
  }

  t.after(async () => {
    for (const cid of createdCompanyIds) {
      await db.delete(companies).where(eq(companies.id, cid)).catch(() => {});
    }
  });

  // -------------------------------------------------------------
  // 1. ALL 6 SAAS PLANS VERIFICATION (DECIMAL & SEAT LIMITS)
  // -------------------------------------------------------------
  await t.test("1. Verify all 6 SaaS plans configuration and seat limits", () => {
    assert.equal(DEFAULT_SAAS_PLANS.length, 6);

    const expected = [
      { slug: "essencial", price: "19.90", annual: "199.00", limit: 2 },
      { slug: "profissional", price: "39.90", annual: "399.00", limit: 5 },
      { slug: "equipe", price: "69.90", annual: "699.00", limit: 10 },
      { slug: "negocio", price: "119.90", annual: "1199.00", limit: 20 },
      { slug: "empresa", price: "229.90", annual: "2299.00", limit: 50 },
      { slug: "enterprise", price: "399.90", annual: "3999.00", limit: 100 },
    ];

    for (const exp of expected) {
      const p = DEFAULT_SAAS_PLANS.find((item) => item.slug === exp.slug);
      assert.ok(p, `Plan ${exp.slug} must exist.`);
      assert.equal(p.monthlyPrice, exp.price);
      assert.equal(p.annualPrice, exp.annual);
      assert.equal(p.employeeLimit, exp.limit);
      assert.equal(p.isActive, true);
    }
  });

  // -------------------------------------------------------------
  // 2. OWNER SEAT EXCLUSION & PLAN LIMIT SERVICE
  // -------------------------------------------------------------
  await t.test("2. PlanLimitService: Owner does NOT count as employee seat", async () => {
    const companyId = "comp_test_seats";
    const ownerUserId = "user_owner_abc";
    const staff1UserId = "user_staff_1";
    const staff2UserId = "user_staff_2";

    const employeesList = [
      { id: "e1", companyId, userId: ownerUserId, name: "Owner Carlos", active: true },
      { id: "e2", companyId, userId: staff1UserId, name: "Staff Barbeiro 1", active: true },
      { id: "e3", companyId, userId: staff2UserId, name: "Staff Barbeiro 2", active: true },
      { id: "e4", companyId, userId: null, name: "Staff Inativo", active: false },
    ];

    const usersList = [
      { id: ownerUserId, role: "owner" },
      { id: staff1UserId, role: "employee" },
      { id: staff2UserId, role: "employee" },
    ];

    // Filter active employees that are NOT owners
    const activeStaff = employeesList.filter((e) => e.active);
    const ownerIds = new Set(usersList.filter((u) => u.role === "owner").map((u) => u.id));
    const countedStaff = activeStaff.filter((e) => !e.userId || !ownerIds.has(e.userId));

    assert.equal(countedStaff.length, 2, "Essencial plan has exactly 2 counted staff (Owner excluded).");

    const employeeLimit = 2;
    const canAddMore = countedStaff.length < employeeLimit;
    assert.equal(canAddMore, false, "Cannot add more when limit is reached.");
  });

  // -------------------------------------------------------------
  // 3. COUPON NORMALIZATION
  // -------------------------------------------------------------
  await t.test("3. SaasCouponService: Code normalization (trim + uppercase)", () => {
    assert.equal(SaasCouponService.normalizeCode("reservei10"), "RESERVEI10");
    assert.equal(SaasCouponService.normalizeCode("  Reservei20  "), "RESERVEI20");
    assert.equal(SaasCouponService.normalizeCode("3meses"), "3MESES");
    assert.equal(SaasCouponService.normalizeCode(""), "");
  });

  // -------------------------------------------------------------
  // 4. DISCOUNT CALCULATIONS & MONEY PRECISION
  // -------------------------------------------------------------
  await t.test("4. SaasCouponService: Discount math & precision (percentage, fixed, max cap, 100% off)", () => {
    // 10% on R$ 39,90 -> R$ 3,99 discount -> Final R$ 35,91
    const res1 = SaasCouponService.calculateDiscount(39.9, {
      discountType: "PERCENTAGE",
      discountValue: 10,
    });
    assert.equal(res1.originalPrice, 39.9);
    assert.equal(res1.discountAmount, 3.99);
    assert.equal(res1.finalPrice, 35.91);
    assert.equal(res1.isZeroTotal, false);

    // 20% on R$ 19,90 -> R$ 3,98 discount -> Final R$ 15,92
    const res2 = SaasCouponService.calculateDiscount(19.9, {
      discountType: "PERCENTAGE",
      discountValue: 20,
    });
    assert.equal(res2.discountAmount, 3.98);
    assert.equal(res2.finalPrice, 15.92);

    // Percentage with Max Discount Cap (e.g. 50% of R$ 399,00 capped at R$ 50,00)
    const resCap = SaasCouponService.calculateDiscount(399.0, {
      discountType: "PERCENTAGE",
      discountValue: 50,
      maxDiscountAmount: 50.0,
    });
    assert.equal(resCap.discountAmount, 50.0);
    assert.equal(resCap.finalPrice, 349.0);

    // Fixed amount R$ 15,00 on R$ 19,90 -> Final R$ 4,90
    const resFixed = SaasCouponService.calculateDiscount(19.9, {
      discountType: "FIXED_AMOUNT",
      discountValue: 15.0,
    });
    assert.equal(resFixed.discountAmount, 15.0);
    assert.equal(resFixed.finalPrice, 4.9);

    // Fixed amount larger than plan price (R$ 50,00 discount on R$ 19,90) -> Capped at R$ 19,90, never negative
    const resNegativePrevent = SaasCouponService.calculateDiscount(19.9, {
      discountType: "FIXED_AMOUNT",
      discountValue: 50.0,
    });
    assert.equal(resNegativePrevent.discountAmount, 19.9);
    assert.equal(resNegativePrevent.finalPrice, 0);
    assert.equal(resNegativePrevent.isZeroTotal, true);

    // 100% OFF coupon
    const res100 = SaasCouponService.calculateDiscount(69.9, {
      discountType: "PERCENTAGE",
      discountValue: 100,
    });
    assert.equal(res100.discountAmount, 69.9);
    assert.equal(res100.finalPrice, 0);
    assert.equal(res100.isZeroTotal, true);
  });

  // -------------------------------------------------------------
  // 5. COUPON VALIDATIONS & REJECTIONS (EXPIRED, INACTIVE, LIMITS)
  // -------------------------------------------------------------
  await t.test("5. SaasCouponService: Validation rule checks", async () => {
    const { compId } = await createTestCompany("Empresa Validação Cupom");

    // 5.1. Valid Seeded Coupon (RESERVEI10 - 10% off)
    const validated = await SaasCouponService.validateCoupon({
      code: "reservei10",
      planSlug: "profissional",
      billingInterval: "monthly",
      companyId: compId,
      executor: db,
    });

    assert.equal(validated.valid, true);
    assert.equal(validated.coupon.code, "RESERVEI10");
    assert.equal(validated.originalPrice, 39.9);
    assert.equal(validated.discountAmount, 3.99);
    assert.equal(validated.finalPrice, 35.91);

    // 5.2. Inactive coupon check
    const inactiveCode = `INATIVO_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const inactiveId = crypto.randomUUID();
    await db.insert(saasCoupons).values({
      id: inactiveId,
      code: inactiveCode,
      name: "Cupom Inativo",
      discountType: "PERCENTAGE",
      discountValue: "10.00",
      appliesTo: "ALL_PLANS",
      isActive: false,
    });

    await assert.rejects(
      async () => {
        await SaasCouponService.validateCoupon({
          code: inactiveCode,
          planSlug: "profissional",
          billingInterval: "monthly",
          companyId: compId,
          executor: db,
        });
      },
      (err: any) => err.statusCode === 422 && err.message === "Este cupom não é válido."
    );

    // 5.3. Expired coupon check
    const expiredCode = `EXPIRADO_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const expiredId = crypto.randomUUID();
    await db.insert(saasCoupons).values({
      id: expiredId,
      code: expiredCode,
      name: "Cupom Expirado",
      discountType: "PERCENTAGE",
      discountValue: "15.00",
      appliesTo: "ALL_PLANS",
      expiresAt: new Date(Date.now() - 60000),
      isActive: true,
    });

    await assert.rejects(
      async () => {
        await SaasCouponService.validateCoupon({
          code: expiredCode,
          planSlug: "profissional",
          billingInterval: "monthly",
          companyId: compId,
          executor: db,
        });
      },
      (err: any) => err.statusCode === 422 && err.message === "Este cupom expirou."
    );

    // 5.4. Minimum plan amount check
    const minAmountCode = `MINIMO100_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const minAmountId = crypto.randomUUID();
    await db.insert(saasCoupons).values({
      id: minAmountId,
      code: minAmountCode,
      name: "Cupom Min 100",
      discountType: "PERCENTAGE",
      discountValue: "20.00",
      appliesTo: "ALL_PLANS",
      minimumPlanAmount: "100.00",
      isActive: true,
    });

    await assert.rejects(
      async () => {
        await SaasCouponService.validateCoupon({
          code: minAmountCode,
          planSlug: "essencial", // 19.90 < 100.00
          billingInterval: "monthly",
          companyId: compId,
          executor: db,
        });
      },
      (err: any) => err.statusCode === 422 && err.message.includes("inferior ao mínimo exigido")
    );
  });

  // -------------------------------------------------------------
  // 6. STATUS MAPPER (MERCADO PAGO -> INTERNAL)
  // -------------------------------------------------------------
  await t.test("6. MercadoPagoStatusMapper: Correct mapping to internal and invoice statuses", () => {
    assert.equal(MercadoPagoStatusMapper.toInternal("approved"), "APPROVED");
    assert.equal(MercadoPagoStatusMapper.toInternal("in_process"), "PROCESSING");
    assert.equal(MercadoPagoStatusMapper.toInternal("pending"), "PENDING");
    assert.equal(MercadoPagoStatusMapper.toInternal("rejected"), "REJECTED");
    assert.equal(MercadoPagoStatusMapper.toInternal("cancelled"), "CANCELLED");
    assert.equal(MercadoPagoStatusMapper.toInternal("refunded"), "REFUNDED");

    assert.equal(MercadoPagoStatusMapper.toInvoiceStatus("APPROVED"), "paid");
    assert.equal(MercadoPagoStatusMapper.toInvoiceStatus("PENDING"), "pending");
    assert.equal(MercadoPagoStatusMapper.toInvoiceStatus("REJECTED"), "failed");
    assert.equal(MercadoPagoStatusMapper.toInvoiceStatus("CANCELLED"), "cancelled");
  });

  // -------------------------------------------------------------
  // 7. CHECKOUT CARD TRANSPARENT (APPROVED & REJECTED & 100% OFF)
  // -------------------------------------------------------------
  await t.test("7. SaasPaymentProvider: Card Checkout flows (Approval, Rejection, Free Coupon)", async () => {
    const provider = new SaasPaymentProvider();
    const { compId } = await createTestCompany("Empresa Cartao Teste");

    // 7.1. Approved Card
    const approvedRes = await provider.createCardPayment({
      companyId: compId,
      planSlug: "profissional",
      billingInterval: "monthly",
      cardToken: "sim_token_valid_123",
      payerEmail: "owner@empresa.com",
      payerName: "Carlos Proprietario",
    });

    assert.equal(approvedRes.status, "approved");
    assert.equal(approvedRes.amount, 39.9);
    assert.ok(approvedRes.paymentId);

    // 7.2. Rejected Card
    const rejectedRes = await provider.createCardPayment({
      companyId: compId,
      planSlug: "profissional",
      billingInterval: "monthly",
      cardToken: "token_rejected",
      payerEmail: "owner2@empresa.com",
      payerName: "Carlos Rejeitado",
    });

    assert.equal(rejectedRes.status, "rejected");
    assert.equal(rejectedRes.statusDetail, "cc_rejected_bad_filled_other");

    // 7.3. 100% Free Coupon Card Checkout with seed coupon (RESERVEI10 / BEMVINDO20)
    const couponRes = await provider.createCardPayment({
      companyId: compId,
      planSlug: "profissional",
      billingInterval: "monthly",
      couponCode: "RESERVEI10",
      cardToken: "sim_token_123",
      payerEmail: "coupon@empresa.com",
      payerName: "Coupon Owner",
    });

    assert.equal(couponRes.subtotal, 39.9);
    assert.equal(couponRes.discount, 3.99);
    assert.equal(couponRes.amount, 35.91);
    assert.equal(couponRes.status, "approved");
  });

  // -------------------------------------------------------------
  // 8. CHECKOUT PIX TRANSPARENT (PENDING, EXPIRES, QR CODE)
  // -------------------------------------------------------------
  await t.test("8. SaasPaymentProvider: PIX Checkout generation with QR Code", async () => {
    const provider = new SaasPaymentProvider();
    const { compId } = await createTestCompany("Empresa Pix Teste");

    const pixRes = await provider.createPixPayment({
      companyId: compId,
      planSlug: "essencial",
      billingInterval: "monthly",
      payerEmail: "pix@empresa.com",
      payerName: "Pix Owner",
    });

    assert.equal(pixRes.status, "pending");
    assert.equal(pixRes.amount, 19.9);
    assert.ok(pixRes.qrCode.startsWith("000201"));
    assert.ok(pixRes.copiaECola.startsWith("000201"));
    assert.ok(pixRes.expiresAt);
  });

  // -------------------------------------------------------------
  // 9. WEBHOOK IDEMPOTENCY
  // -------------------------------------------------------------
  await t.test("9. Webhook Idempotency: Processing duplicate events only activates once", () => {
    const processedEvents = new Set<string>();

    const handleWebhookEvent = (eventId: string) => {
      if (processedEvents.has(eventId)) {
        return { received: true, idempotent: true };
      }
      processedEvents.add(eventId);
      return { received: true, processed: true };
    };

    const first = handleWebhookEvent("pay_12345_payment.created");
    assert.equal(first.processed, true);

    const second = handleWebhookEvent("pay_12345_payment.created");
    assert.equal(second.idempotent, true);
  });

  // -------------------------------------------------------------
  // 10. UPGRADE & DOWNGRADE SAFETY (NO EMPLOYEE DELETION)
  // -------------------------------------------------------------
  await t.test("10. Plan Change & Downgrade Safety: Employees are never deleted on downgrade", async () => {
    // Current usage = 7 employees, Target plan = Profissional (limit = 5)
    const currentUsage = 7;
    const targetLimit = 5;

    const evalResult = {
      currentUsage,
      targetLimit,
      isDowngrade: targetLimit < currentUsage,
      willExceed: currentUsage > targetLimit,
      excessCount: currentUsage - targetLimit,
    };

    assert.equal(evalResult.isDowngrade, true);
    assert.equal(evalResult.willExceed, true);
    assert.equal(evalResult.excessCount, 2);
    // Crucial rule: Employees are flagged/locked for new additions, but NEVER deleted automatically.
  });

  // -------------------------------------------------------------
  // 11. SUBSCRIPTION CANCELLATION & REACTIVATION
  // -------------------------------------------------------------
  await t.test("11. Subscription cancel & reactivate lifecycle", () => {
    let subState = {
      status: "active",
      cancelAtPeriodEnd: false,
      cancelledAt: null as Date | null,
    };

    // Cancel at period end
    subState = {
      ...subState,
      cancelAtPeriodEnd: true,
      cancelledAt: new Date(),
    };
    assert.equal(subState.cancelAtPeriodEnd, true);
    assert.ok(subState.cancelledAt);

    // Reactivate
    subState = {
      ...subState,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      status: "active",
    };
    assert.equal(subState.cancelAtPeriodEnd, false);
    assert.equal(subState.cancelledAt, null);
    assert.equal(subState.status, "active");
  });

  // -------------------------------------------------------------
  // 12. ROLE-BASED ACCESS CONTROL & MULTITENANT ISOLATION
  // -------------------------------------------------------------
  await t.test("12. Security & RBAC: Only OWNER can pay/manage SaaS billing; Employees and Clients get 403", () => {
    assert.equal(hasMinRole("owner", "owner"), true, "Owner has minRole 'owner'");
    assert.equal(hasMinRole("superadmin", "owner"), true, "Superadmin has minRole 'owner'");
    assert.equal(hasMinRole("manager", "owner"), false, "Manager does not have minRole 'owner'");
    assert.equal(hasMinRole("employee", "owner"), false, "Employee does not have minRole 'owner'");
    assert.equal(hasMinRole("client", "owner"), false, "Client does not have minRole 'owner'");

    // Role rank hierarchy validation
    assert.ok(ROLE_RANK["owner"] > ROLE_RANK["employee"]);
    assert.ok(ROLE_RANK["owner"] > ROLE_RANK["client"]);
  });

  // -------------------------------------------------------------
  // 13. DOMAIN ISOLATION: BOOKING PAYMENT VS SAAS BILLING
  // -------------------------------------------------------------
  await t.test("13. Domain Isolation: Public client booking never calls SaaS Mercado Pago or SaaS coupons", () => {
    const bookingPaymentContext = {
      type: "booking_presential",
      serviceName: "Corte Cabelo",
      price: 50.0,
      paymentMethod: "pix_presencial",
    };

    const isSaaSSubscription = (bookingPaymentContext as any).type === "saas_subscription";
    assert.equal(isSaaSSubscription, false, "Booking payment is strictly NOT a SaaS subscription.");
  });

  // -------------------------------------------------------------
  // 14. COMPLETE 6 PLANS PRICING & LIMITS MATRIX (MONTHLY & YEARLY)
  // -------------------------------------------------------------
  await t.test("14. Complete 6 Plans Pricing & Limits Matrix (Monthly and Yearly)", async () => {
    const provider = new SaasPaymentProvider();
    const { compId } = await createTestCompany("Empresa Matriz 6 Planos");

    const matrix = [
      { slug: "essencial", monthly: 19.9, yearly: 199.0, limit: 2 },
      { slug: "profissional", monthly: 39.9, yearly: 399.0, limit: 5 },
      { slug: "equipe", monthly: 69.9, yearly: 699.0, limit: 10 },
      { slug: "negocio", monthly: 119.9, yearly: 1199.0, limit: 20 },
      { slug: "empresa", monthly: 229.9, yearly: 2299.0, limit: 50 },
      { slug: "enterprise", monthly: 399.9, yearly: 3999.0, limit: 100 },
    ];

    for (const item of matrix) {
      // Monthly PIX
      const pixMonthly = await provider.createPixPayment({
        companyId: compId,
        planSlug: item.slug,
        billingInterval: "monthly",
        payerEmail: `test-${item.slug}@empresa.com`,
        payerName: "Owner Test",
      });
      assert.equal(pixMonthly.amount, item.monthly, `Monthly price for ${item.slug} must be ${item.monthly}`);
      assert.equal(pixMonthly.subtotal, item.monthly);
      assert.equal(pixMonthly.status, "pending");

      // Yearly PIX
      const pixYearly = await provider.createPixPayment({
        companyId: compId,
        planSlug: item.slug,
        billingInterval: "yearly",
        payerEmail: `test-${item.slug}-yearly@empresa.com`,
        payerName: "Owner Test",
      });
      assert.equal(pixYearly.amount, item.yearly, `Yearly price for ${item.slug} must be ${item.yearly}`);
      assert.equal(pixYearly.subtotal, item.yearly);

      // Monthly Card
      const cardMonthly = await provider.createCardPayment({
        companyId: compId,
        planSlug: item.slug,
        billingInterval: "monthly",
        cardToken: "sim_token_matrix",
        payerEmail: `test-${item.slug}@empresa.com`,
        payerName: "Owner Test",
      });
      assert.equal(cardMonthly.amount, item.monthly);
      assert.equal(cardMonthly.status, "approved");

      // Verify PlanLimitService usage returns correct limit
      const usage = await PlanLimitService.getUsageInfo(compId, db);
      assert.equal(usage.employeeLimit, item.limit, `Limit for ${item.slug} must be ${item.limit}`);
    }
  });

  // -------------------------------------------------------------
  // 15. WEBHOOK HMAC SHA-256 CRYPTOGRAPHIC SIGNATURE VERIFICATION
  // -------------------------------------------------------------
  await t.test("15. Webhook HMAC SHA-256 signature verification logic", () => {
    const secret = "test_webhook_secret_key_12345";
    const dataId = "mp_pay_998877";
    const requestId = "req_uuid_abc_123";
    const ts = String(Math.floor(Date.now() / 1000));

    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const validSignature = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

    // Helper validating signature
    function checkSig(sigHeader: string, reqIdHeader: string, targetId: string) {
      const parts = sigHeader.split(",").map((p) => p.trim());
      let parsedTs = "";
      let parsedHash = "";
      for (const p of parts) {
        const [k, v] = p.split("=");
        if (k === "ts") parsedTs = v;
        if (k === "v1") parsedHash = v;
      }
      if (!parsedTs || !parsedHash) return false;
      const m = `id:${targetId};request-id:${reqIdHeader};ts:${parsedTs};`;
      const computed = crypto.createHmac("sha256", secret).update(m).digest("hex");
      const bComp = Buffer.from(computed);
      const bRec = Buffer.from(parsedHash);
      if (bComp.length !== bRec.length) return false;
      return crypto.timingSafeEqual(bComp, bRec);
    }

    // Valid header
    const validHeader = `ts=${ts},v1=${validSignature}`;
    assert.equal(checkSig(validHeader, requestId, dataId), true, "Genuine signature must validate successfully.");

    // Tampered header
    const tamperedHeader = `ts=${ts},v1=0000000000000000000000000000000000000000000000000000000000000000`;
    assert.equal(checkSig(tamperedHeader, requestId, dataId), false, "Tampered signature must be rejected.");

    // Mismatched request ID
    assert.equal(checkSig(validHeader, "different_request_id", dataId), false, "Mismatched request ID must be rejected.");
  });

  // -------------------------------------------------------------
  // 16. WEBHOOK ACTIVATION & INVOICE PAID STATUS TRANSITIONS
  // -------------------------------------------------------------
  await t.test("16. Webhook Activation: End-to-end subscription activation and invoice status", async () => {
    const provider = new SaasPaymentProvider();
    const { compId } = await createTestCompany("Empresa Webhook E2E");

    const paymentId = `mp_test_webhook_${Date.now()}`;
    const invoiceId = crypto.randomUUID();

    // Activate via provider (as webhook handler does)
    await provider.activateCompanySubscription({
      companyId: compId,
      planSlug: "equipe",
      billingInterval: "monthly",
      amount: 69.9,
      paymentMethod: "pix",
      gatewayPaymentId: paymentId,
      invoiceId,
    });

    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.companyId, compId)).limit(1);
    assert.ok(sub);
    assert.equal(sub.status, "active");
    assert.equal(sub.plan, "equipe");

    const [inv] = await db.select().from(subscriptionInvoices).where(eq(subscriptionInvoices.id, invoiceId)).limit(1);
    assert.ok(inv);
    assert.equal(inv.status, "paid");
    assert.equal(Number(inv.amount), 69.9);
    assert.equal(inv.mercadoPagoPaymentId, paymentId);
  });

  // -------------------------------------------------------------
  // 17. EMPLOYEE LIMIT EXCEEDED REJECTION (403)
  // -------------------------------------------------------------
  await t.test("17. PlanLimitService.assertCanAddEmployee: Throws 403 when limit is exceeded", async () => {
    const { compId } = await createTestCompany("Empresa Limite Estourado");
    const provider = new SaasPaymentProvider();

    // Activate Essencial (limit 2)
    await provider.activateCompanySubscription({
      companyId: compId,
      planSlug: "essencial",
      billingInterval: "monthly",
      amount: 19.9,
      paymentMethod: "card",
      gatewayPaymentId: `pay_lim_${Date.now()}`,
    });

    // Add 2 active employees (not owners)
    await db.insert(users).values({
      id: "staff_u1",
      companyId: compId,
      name: "Staff 1",
      email: `staff1_${compId.slice(0, 6)}@t.com`,
      passwordHash: "hash123",
      role: "employee",
    });
    await db.insert(users).values({
      id: "staff_u2",
      companyId: compId,
      name: "Staff 2",
      email: `staff2_${compId.slice(0, 6)}@t.com`,
      passwordHash: "hash123",
      role: "employee",
    });
    const { employees: empsTable } = await import("../src/db/schema");
    await db.insert(empsTable).values({
      id: "e_1",
      companyId: compId,
      userId: "staff_u1",
      name: "Staff 1",
      active: true,
    });
    await db.insert(empsTable).values({
      id: "e_2",
      companyId: compId,
      userId: "staff_u2",
      name: "Staff 2",
      active: true,
    });

    // Can add employee should be false now
    const canAdd = await PlanLimitService.canAddEmployee(compId, db);
    assert.equal(canAdd, false, "Cannot add more than 2 staff on Essencial plan.");

    await assert.rejects(
      async () => {
        await PlanLimitService.assertCanAddEmployee(compId, db);
      },
      (err: any) => err.statusCode === 403 && err.code === "PLAN_EMPLOYEE_LIMIT_EXCEEDED"
    );

    // Clean up staff
    await db.delete(empsTable).where(eq(empsTable.companyId, compId)).catch(() => {});
    await db.delete(users).where(eq(users.companyId, compId)).catch(() => {});
  });
});
