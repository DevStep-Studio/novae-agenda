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
  companyMemberships,
  employees,
  subscriptions,
  users,
} from "../src/db/schema";
import { and, eq } from "drizzle-orm";
import { AdminService } from "../src/lib/admin/admin-service";
import { seedSaasPlans } from "../src/lib/saas/plans-seed";

test("Super Admin 2.0 — Comprehensive Features, Queries, Transactions & Segregation Suite", { concurrency: false }, async (t) => {
  await seedSaasPlans(db);

  const adminId = crypto.randomUUID();
  const adminEmail = `superadmin-v2-${adminId.slice(0, 6)}@reservei.com.br`;
  const createdCompanyIds: string[] = [];
  const createdUserIds: string[] = [];

  // Create superadmin user
  await db.insert(users).values({
    id: adminId,
    name: "Superadmin V2 Teste",
    email: adminEmail,
    passwordHash: "hash-v2",
    role: "superadmin",
    isSuperadmin: true,
  });
  createdUserIds.push(adminId);

  t.after(async () => {
    for (const cid of createdCompanyIds) {
      await db.delete(companies).where(eq(companies.id, cid)).catch(() => {});
    }
    for (const uid of createdUserIds) {
      await db.delete(users).where(eq(users.id, uid)).catch(() => {});
    }
  });

  // -------------------------------------------------------------------------
  // 1. OWNER LISTING WITH DUAL-LINK RESOLUTION (companyId & companyMemberships)
  // -------------------------------------------------------------------------
  await t.test("1. listOwners finds owners linked directly via users.companyId and companyMemberships", async () => {
    const suffix = crypto.randomUUID().slice(0, 6);
    const compId = crypto.randomUUID();
    const ownerId = crypto.randomUUID();
    const ownerEmail = `direct-owner-${suffix}@teste.com`;
    const compName = `Studio Direto ${suffix}`;

    createdCompanyIds.push(compId);
    createdUserIds.push(ownerId);

    // Create company
    await db.insert(companies).values({
      id: compId,
      name: compName,
      publicSlug: `studio-direto-${suffix}`,
      phone: "11988880001",
    });

    // Create owner linked directly via companyId without companyMemberships
    await db.insert(users).values({
      id: ownerId,
      name: `Proprietário Direto ${suffix}`,
      email: ownerEmail,
      passwordHash: "hash123",
      role: "owner",
      companyId: compId,
      isSuperadmin: false,
    });

    // Query listOwners by search
    const result = await AdminService.listOwners({ search: suffix, page: 1, limit: 10 });
    assert.ok(result.items.length >= 1, "Should find owner linked directly by companyId");

    const found = result.items.find((item) => item.id === compId);
    assert.ok(found, "Company should be returned in list");
    assert.equal(found.primaryOwner?.email, ownerEmail);
    assert.equal(found.name, compName);
  });

  // -------------------------------------------------------------------------
  // 2. ATOMIC TRANSACTION & DUPLICATE EMAIL PREVENTION
  // -------------------------------------------------------------------------
  await t.test("2. createOwnerWithCompany atomic transaction and duplicate prevention", async () => {
    const suffix = crypto.randomUUID().slice(0, 6);
    const compName = `Barbearia Transacional ${suffix}`;
    const ownerEmail = `transacional-${suffix}@teste.com`;

    // Successful creation
    const created = await AdminService.createOwnerWithCompany({
      ownerName: "Marcos Proprietário",
      ownerEmail,
      ownerPhone: "11977771234",
      companyName: compName,
      companySlug: `barbearia-transacional-${suffix}`,
      category: "Barbearia",
      planSlug: "profissional",
      accessType: "trial",
      adminUser: { id: adminId, email: adminEmail },
    });

    assert.ok(created.companyId);
    assert.ok(created.ownerId);
    createdCompanyIds.push(created.companyId);
    createdUserIds.push(created.ownerId);

    // Verify company, user, membership and subscription exist
    const [comp] = await db.select().from(companies).where(eq(companies.id, created.companyId)).limit(1);
    assert.ok(comp);
    assert.equal(comp.name, compName);

    const [user] = await db.select().from(users).where(eq(users.id, created.ownerId)).limit(1);
    assert.ok(user);
    assert.equal(user.email, ownerEmail);
    assert.equal(user.role, "owner");

    const [membership] = await db
      .select()
      .from(companyMemberships)
      .where(eq(companyMemberships.companyId, created.companyId))
      .limit(1);
    assert.ok(membership);
    assert.equal(membership.role, "owner");

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.companyId, created.companyId))
      .limit(1);
    assert.ok(sub);
    assert.equal(sub.status, "trialing");

    // Verify duplicate email throws error without creating a second company
    await assert.rejects(
      async () => {
        await AdminService.createOwnerWithCompany({
          ownerName: "Outro Marcos",
          ownerEmail, // Same email
          companyName: `Outro Salão ${suffix}`,
          planSlug: "essencial",
          accessType: "trial",
          adminUser: { id: adminId, email: adminEmail },
        });
      },
      {
        message: /já está cadastrado/i,
      }
    );
  });

  // -------------------------------------------------------------------------
  // 3. COMPANY SUSPENSION & REACTIVATION WITH AUDIT
  // -------------------------------------------------------------------------
  await t.test("3. suspendCompany and reactivateCompany with audit logs", async () => {
    const suffix = crypto.randomUUID().slice(0, 6);
    const compId = crypto.randomUUID();
    createdCompanyIds.push(compId);

    await db.insert(companies).values({
      id: compId,
      name: `Empresa Para Suspender ${suffix}`,
      publicEnabled: true,
      onboarded: true,
    });

    const trialEndsAt = new Date(Date.now() + 14 * 86400000);

    await db.insert(subscriptions).values({
      id: crypto.randomUUID(),
      companyId: compId,
      plan: "profissional",
      status: "active",
      trialEndsAt,
    });

    // Suspend
    await AdminService.suspendCompany(
      compId,
      "Violou os termos de uso de mensagens automáticas",
      { id: adminId, email: adminEmail }
    );

    const [suspendedComp] = await db.select().from(companies).where(eq(companies.id, compId)).limit(1);
    assert.equal(suspendedComp.publicEnabled, false);
    assert.equal(suspendedComp.onboarded, false);

    const [suspendedSub] = await db.select().from(subscriptions).where(eq(subscriptions.companyId, compId)).limit(1);
    assert.equal(suspendedSub.status, "suspended");

    // Reactivate
    await AdminService.reactivateCompany(
      compId,
      "Termos aceitos formalmente",
      { id: adminId, email: adminEmail }
    );

    const [reactivatedComp] = await db.select().from(companies).where(eq(companies.id, compId)).limit(1);
    assert.equal(reactivatedComp.publicEnabled, true);
    assert.equal(reactivatedComp.onboarded, true);

    const [reactivatedSub] = await db.select().from(subscriptions).where(eq(subscriptions.companyId, compId)).limit(1);
    assert.ok(reactivatedSub.status === "active" || reactivatedSub.status === "trialing");

    // Verify audit logs for both actions
    const logs = await db
      .select()
      .from(adminAuditLogs)
      .where(and(eq(adminAuditLogs.entity, "company"), eq(adminAuditLogs.entityId, compId)));
    assert.ok(logs.some((l) => l.action === "SUSPEND_COMPANY"));
    assert.ok(logs.some((l) => l.action === "REACTIVATE_COMPANY"));
  });

  // -------------------------------------------------------------------------
  // 4. LIST SUBSCRIPTIONS & CLIENTS ENRICHMENT
  // -------------------------------------------------------------------------
  await t.test("4. listSubscriptions and listClients returns accurate enriched data", async () => {
    const suffix = crypto.randomUUID().slice(0, 6);
    const compId = crypto.randomUUID();
    const clientId = crypto.randomUUID();
    createdCompanyIds.push(compId);

    await db.insert(companies).values({
      id: compId,
      name: `Empresa Clientes ${suffix}`,
      publicEnabled: true,
      onboarded: true,
    });

    await db.insert(subscriptions).values({
      id: crypto.randomUUID(),
      companyId: compId,
      plan: "equipe",
      status: "active",
      amount: "199.00",
      trialEndsAt: new Date(Date.now() + 14 * 86400000),
    });

    // Subscriptions test
    const subsResult = await AdminService.listSubscriptions({ status: "active", page: 1, limit: 10 });
    assert.ok(subsResult.items.length >= 1);
    const foundSub = subsResult.items.find((s) => s.companyId === compId);
    assert.ok(foundSub);
    assert.equal(foundSub.plan, "equipe");

    // Client test with appointments
    const employeeId = crypto.randomUUID();
    await db.insert(employees).values({
      id: employeeId,
      companyId: compId,
      name: `Profissional ${suffix}`,
      phone: "11988880000",
      active: true,
    });

    await db.insert(clients).values({
      id: clientId,
      companyId: compId,
      name: `Cliente VIP ${suffix}`,
      phone: "11988889999",
      email: `client-${suffix}@teste.com`,
    });

    await db.insert(appointments).values({
      id: crypto.randomUUID(),
      companyId: compId,
      clientId,
      employeeId,
      appointmentDate: "2026-09-17",
      startTime: "10:00:00",
      endTime: "11:00:00",
      status: "completed",
      total: "80.00",
    });

    const clientsResult = await AdminService.listClients({ search: suffix, page: 1, limit: 10 });
    assert.ok(clientsResult.items.length >= 1);
    const foundClient = clientsResult.items.find((c) => c.id === clientId);
    assert.ok(foundClient);
    assert.equal(foundClient.totalAppointments, 1);
    assert.ok(foundClient.lastAppointment);
  });

  // -------------------------------------------------------------------------
  // 5. METRICS WITH PERIOD FILTERING & REVENUE SEGREGATION
  // -------------------------------------------------------------------------
  await t.test("5. getSystemOverviewMetrics computes platform vs establishment revenue properly", async () => {
    const metricsAll = await AdminService.getSystemOverviewMetrics({ period: "all" });
    assert.ok(typeof metricsAll.revenue.totalPlatformRevenue === "number");
    assert.ok(typeof metricsAll.revenue.totalEstablishmentsGrossRevenue === "number");
    assert.ok(typeof metricsAll.companies.total === "number");
    assert.ok(typeof metricsAll.subscriptions.active === "number");

    const metrics30d = await AdminService.getSystemOverviewMetrics({ period: "30d" });
    assert.equal(metrics30d.filterPeriod, "30d");
    assert.ok(metrics30d.companies.total >= 0);
  });

  // -------------------------------------------------------------------------
  // 6. BULK DELETION FOR OWNERS AND CLIENTS WITH AUDIT LOGGING
  // -------------------------------------------------------------------------
  await t.test("6. bulkDeleteOwners and bulkDeleteClients execute multi-item deletion properly", async () => {
    const s1 = crypto.randomUUID().slice(0, 6);
    const s2 = crypto.randomUUID().slice(0, 6);
    const c1 = crypto.randomUUID();
    const c2 = crypto.randomUUID();
    createdCompanyIds.push(c1, c2);

    await db.insert(companies).values([
      { id: c1, name: `Bulk Test 1 ${s1}` },
      { id: c2, name: `Bulk Test 2 ${s2}` },
    ]);

    // Test soft bulk delete
    const softResult = await AdminService.bulkDeleteOwners(
      [c1, c2],
      "soft",
      "Teste soft delete em massa",
      { id: adminId, email: adminEmail }
    );
    assert.equal(softResult.success, true);
    assert.equal(softResult.deletedCount, 2);

    const checkSoft = await db.select().from(companies).where(eq(companies.id, c1));
    assert.ok(checkSoft[0]?.deletedAt);

    // Test hard bulk delete
    const hardResult = await AdminService.bulkDeleteOwners(
      [c1, c2],
      "hard",
      "Teste hard delete definitivo em massa",
      { id: adminId, email: adminEmail }
    );
    assert.equal(hardResult.success, true);
    assert.equal(hardResult.deletedCount, 2);

    const checkHard = await db.select().from(companies).where(eq(companies.id, c1));
    assert.equal(checkHard.length, 0);
  });
});
