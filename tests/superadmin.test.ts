import "dotenv/config";
process.env.DATABASE_URL = process.env.DATABASE_URL || "mysql://root:password@localhost:3306/novae_agenda";

import crypto from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/db";
import {
  adminAuditLogs,
  appointments,
  clients,
  companies,
  employees,
  saasCouponRedemptions,
  saasCoupons,
  subscriptions,
  users,
} from "../src/db/schema";
import { eq } from "drizzle-orm";
import { AdminService } from "../src/lib/admin/admin-service";
import { SaasCouponService } from "../src/lib/saas/coupon-service";
import { seedSaasPlans } from "../src/lib/saas/plans-seed";

test("Super Admin Backoffice & Direct MySQL Operations — Complete Validation Suite", { concurrency: false }, async (t) => {
  // Ensure SaaS plans exist
  await seedSaasPlans(db);

  const adminId = crypto.randomUUID();
  const adminEmail = `superadmin-${adminId.slice(0, 6)}@reservei.com.br`;
  const createdCompanyIds: string[] = [];
  const createdCouponIds: string[] = [];

  // Create superadmin user in DB for audit log FK
  await db.insert(users).values({
    id: adminId,
    name: "Superadmin Teste",
    email: adminEmail,
    passwordHash: "hash123",
    role: "superadmin",
    isSuperadmin: true,
  });

  t.after(async () => {
    // Clean up created resources
    for (const cid of createdCompanyIds) {
      await db.delete(companies).where(eq(companies.id, cid)).catch(() => {});
    }
    for (const cpid of createdCouponIds) {
      await db.delete(saasCoupons).where(eq(saasCoupons.id, cpid)).catch(() => {});
    }
    await db.delete(users).where(eq(users.id, adminId)).catch(() => {});
  });

  // Setup main test company
  const testCompanyName = `Studio Teste Superadmin ${crypto.randomUUID().slice(0, 6)}`;
  const setupRes = await AdminService.createOwnerManual(
    {
      name: testCompanyName,
      cnpjOrCpf: "12.345.678/0001-90",
      phone: "(11) 98888-7777",
      ownerName: "Carlos Proprietário",
      email: `carlos-${crypto.randomUUID().slice(0, 6)}@teste.com`,
      password: "senhaSegura123",
      planSlug: "profissional",
      reason: "Conta cortesia para parceiro comercial",
    },
    { id: adminId, email: adminEmail }
  );
  const testCompanyId = setupRes.companyId;
  createdCompanyIds.push(testCompanyId);

  // -------------------------------------------------------------
  // 1. MANUAL OWNER CREATION & 360° DETAIL
  // -------------------------------------------------------------
  await t.test("1. Inspect 360° details and audit log for manually created owner", async () => {
    const details = await AdminService.getOwnerDetails(testCompanyId);
    assert.ok(details);
    assert.equal(details.company.name, testCompanyName);
    assert.equal(details.company.cnpjOrCpf, "12.345.678/0001-90");
    assert.equal(details.primaryOwner?.name, "Carlos Proprietário");
    assert.equal(details.subscription?.plan, "profissional");
    assert.equal(details.subscription?.status, "active");

    // Check audit log
    assert.ok(details.auditLogs.length >= 1);
    const creationLog = details.auditLogs.find((l: any) => l.action === "CREATE_OWNER_MANUAL" || l.action === "OWNER_CREATE");
    assert.ok(creationLog);
    assert.equal(creationLog.adminEmail, adminEmail);
  });

  // -------------------------------------------------------------
  // 2. MANUAL SUBSCRIPTION GRANT & REVOCATION
  // -------------------------------------------------------------
  await t.test("2. Grant manual subscription and revoke subscription with audit log", async () => {
    // 2.1 Grant upgraded subscription
    const grantRes = await AdminService.grantSubscriptionManual(
      {
        companyId: testCompanyId,
        planSlug: "equipe",
        originType: "manual_paid",
        periodDays: 60,
        reason: "Upgrade solicitado via atendimento telefônico",
      },
      { id: adminId, email: adminEmail }
    );

    assert.equal(grantRes.planSlug, "equipe");

    // Verify in DB
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.companyId, testCompanyId)).limit(1);
    assert.equal(sub.plan, "equipe");
    assert.equal(sub.origin, "manual_paid");
    assert.equal(sub.status, "active");
    assert.equal(sub.grantedByAdminId, adminId);
    assert.equal(sub.grantReason, "Upgrade solicitado via atendimento telefônico");

    // 2.2 Revoke subscription
    const revokeRes = await AdminService.revokeSubscriptionManual(
      {
        companyId: testCompanyId,
        immediately: true,
        reason: "Cancelamento por inadimplência prolongada",
      },
      { id: adminId, email: adminEmail }
    );

    assert.equal(revokeRes.success, true);

    const [cancelledSub] = await db.select().from(subscriptions).where(eq(subscriptions.companyId, testCompanyId)).limit(1);
    assert.equal(cancelledSub.status, "cancelled");
    assert.equal(cancelledSub.revokedByAdminId, adminId);
    assert.equal(cancelledSub.revokeReason, "Cancelamento por inadimplência prolongada");
  });

  // -------------------------------------------------------------
  // 3. EMPLOYEE DELETION & FUTURE APPOINTMENT TREATMENT
  // -------------------------------------------------------------
  await t.test("3. Employee soft delete with treatment of future appointments", async () => {
    const employeeId = crypto.randomUUID();
    await db.insert(employees).values({
      id: employeeId,
      companyId: testCompanyId,
      name: "Barbeiro João",
      phone: "11988887777",
      active: true,
    });

    // Create client
    const clientId = crypto.randomUUID();
    await db.insert(clients).values({
      id: clientId,
      companyId: testCompanyId,
      name: "Cliente Pedro",
      phone: "11999999999",
    });

    // Create future appointment
    const appointmentId = crypto.randomUUID();
    await db.insert(appointments).values({
      id: appointmentId,
      companyId: testCompanyId,
      clientId,
      employeeId,
      appointmentDate: "2028-12-01",
      startTime: "14:00:00",
      endTime: "15:00:00",
      status: "scheduled",
      total: "100.00",
    });

    // Delete employee with appointment cancellation
    await AdminService.deleteEmployee(
      employeeId,
      "cancel",
      "Desligamento do colaborador",
      { id: adminId, email: adminEmail }
    );

    // Verify employee is soft deleted
    const [emp] = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
    assert.ok(emp.deletedAt !== null);
    assert.equal(emp.deletedBy, adminId);

    // Verify future appointment was cancelled
    const [appt] = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    assert.equal(appt.status, "cancelled");
  });

  // -------------------------------------------------------------
  // 4. INFLUENCER COUPON CREATION, REDEMPTION & CONVERSION
  // -------------------------------------------------------------
  await t.test("4. Influencer coupon creation and conversion to paid subscriber", async () => {
    const couponId = crypto.randomUUID();
    createdCouponIds.push(couponId);
    const couponCode = `INFLUENCER${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

    await db.insert(saasCoupons).values({
      id: couponId,
      code: couponCode,
      name: "Cupom Parceria Moa",
      influencerName: "Moa Barber",
      influencerContact: "@moa_barber",
      discountType: "PERCENTAGE",
      discountValue: "20.00",
      commissionType: "PERCENTAGE",
      commissionValue: "10.00",
      durationType: "ONCE",
      isActive: true,
    });

    // Reserve redemption during signup
    const redemptionId = await SaasCouponService.reserveCouponRedemption({
      couponId,
      companyId: testCompanyId,
      originalAmount: 89.9,
      discountAmount: 17.98,
      finalAmount: 71.92,
    });

    // Verify initial redemption is pending and unconverted
    const [initialRedemption] = await db
      .select()
      .from(saasCouponRedemptions)
      .where(eq(saasCouponRedemptions.id, redemptionId));
    assert.equal(initialRedemption.status, "pending");
    assert.equal(initialRedemption.isConverted, false);
    assert.equal(initialRedemption.convertedAt, null);

    // Confirm payment (simulating webhook notification)
    await SaasCouponService.confirmCouponRedemption({ redemptionId });

    // Verify redemption is confirmed, converted, with conversion date
    const [confirmedRedemption] = await db
      .select()
      .from(saasCouponRedemptions)
      .where(eq(saasCouponRedemptions.id, redemptionId));
    assert.equal(confirmedRedemption.status, "confirmed");
    assert.equal(confirmedRedemption.isConverted, true);
    assert.ok(confirmedRedemption.convertedAt instanceof Date);
  });

  // -------------------------------------------------------------
  // 5. SOFT DELETE VS HARD DELETE FOR OWNER
  // -------------------------------------------------------------
  await t.test("5. Soft delete by default and hard delete requiring exact company name confirmation", async () => {
    // Create dedicated company for deletion tests
    const delCompanyName = `Studio Para Exclusao ${crypto.randomUUID().slice(0, 6)}`;
    const delRes = await AdminService.createOwnerManual(
      {
        name: delCompanyName,
        cnpjOrCpf: "99.888.777/0001-66",
        phone: "(11) 97777-6666",
        ownerName: "Proprietário Para Excluir",
        email: `excluir-${crypto.randomUUID().slice(0, 6)}@teste.com`,
        password: "senha123456",
        planSlug: "essencial",
        reason: "Conta para teste de exclusão",
      },
      { id: adminId, email: adminEmail }
    );
    const delCompanyId = delRes.companyId;
    createdCompanyIds.push(delCompanyId);

    // 5.1 Soft Delete
    await AdminService.softDeleteOwner(
      delCompanyId,
      "Pedido de desativação temporária",
      { id: adminId, email: adminEmail }
    );

    const [softDeletedComp] = await db.select().from(companies).where(eq(companies.id, delCompanyId)).limit(1);
    assert.ok(softDeletedComp.deletedAt !== null);
    assert.equal(softDeletedComp.deletedBy, adminId);

    // Verify subscription is suspended upon soft delete
    const [softSub] = await db.select().from(subscriptions).where(eq(subscriptions.companyId, delCompanyId)).limit(1);
    assert.equal(softSub.status, "suspended");

    // 5.2 Hard Delete validation: fails if name does not match
    await assert.rejects(
      async () => {
        await AdminService.hardDeleteOwner(
          delCompanyId,
          "Nome Errado",
          "Tentativa incorreta",
          { id: adminId, email: adminEmail }
        );
      },
      {
        message: /não confere com o nome da empresa/i,
      }
    );

    // 5.3 Hard Delete with correct name: permanently deletes
    await AdminService.hardDeleteOwner(
      delCompanyId,
      delCompanyName,
      "Exclusão permanente autorizada",
      { id: adminId, email: adminEmail }
    );

    const [hardDeletedComp] = await db.select().from(companies).where(eq(companies.id, delCompanyId)).limit(1);
    assert.equal(hardDeletedComp, undefined);

    // Verify hard delete audit log was saved
    const [hardDeleteLog] = await db
      .select()
      .from(adminAuditLogs)
      .where(eq(adminAuditLogs.action, "HARD_DELETE_OWNER"));
    assert.ok(hardDeleteLog);
  });
});
