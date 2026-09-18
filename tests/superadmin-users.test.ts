import "dotenv/config";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AdminService } from "@/lib/admin/admin-service";
import { db } from "@/db";
import { users, companies } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("Super Admin — Users Management Suite (Direct MySQL)", () => {
  it("1. listUsers returns all users with role, level, company and subscription", async () => {
    const res = await AdminService.listUsers({ page: 1, limit: 50 });
    assert.ok(res.pagination.total >= 1, "Should have users in database");
    assert.ok(res.items.length >= 1, "Should return items");

    const sample = res.items[0];
    assert.ok(sample.id, "User must have an ID");
    assert.ok(sample.name, "User must have a name");
    assert.ok(sample.email, "User must have an email");
    assert.ok(sample.level, "User must have a resolved level");
  });

  it("2. createUserManual creates user, company and subscription atomically in MySQL", async () => {
    const [admin] = await db.select().from(users).where(eq(users.email, "studiodevstep@gmail.com")).limit(1);
    const adminUser = { id: admin?.id || "fallback-id", email: admin?.email || "admin@reservei.test" };
    const uniqueEmail = `test.user.${Date.now()}@reservei.test`;

    const created = await AdminService.createUserManual(
      {
        name: "Usuário Teste Manual",
        email: uniqueEmail,
        role: "owner",
        companyName: `Empresa Teste ${Date.now()}`,
        planSlug: "profissional",
        accessType: "courtesy",
        grantCourtesy: true,
        reason: "Teste de criação direta no MySQL",
      },
      adminUser
    );

    assert.ok(created.userId, "Must return created userId");
    assert.equal(created.email, uniqueEmail);
    assert.ok(created.companyId, "Must have created companyId for owner");

    // Verify in database
    const [inDb] = await db.select().from(users).where(eq(users.id, created.userId)).limit(1);
    assert.ok(inDb, "User must exist in MySQL");
    assert.equal(inDb.name, "Usuário Teste Manual");
    assert.equal(inDb.role, "owner");

    // Verify in listUsers query
    const list = await AdminService.listUsers({ q: uniqueEmail });
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0].email, uniqueEmail);
    assert.equal(list.items[0].subscription?.status, "active");

    // Cleanup
    await db.delete(users).where(eq(users.id, created.userId));
    if (created.companyId) {
      await db.delete(companies).where(eq(companies.id, created.companyId));
    }
  });

  it("3. updateUserRoleAndStatus updates level and active status in MySQL", async () => {
    const [admin] = await db.select().from(users).where(eq(users.email, "studiodevstep@gmail.com")).limit(1);
    const adminUser = { id: admin?.id || "fallback-id", email: admin?.email || "admin@reservei.test" };
    const uniqueEmail = `test.update.${Date.now()}@reservei.test`;

    const created = await AdminService.createUserManual(
      {
        name: "Usuário Update",
        email: uniqueEmail,
        role: "customer",
      },
      adminUser
    );

    // Promote to superadmin and update name
    await AdminService.updateUserRoleAndStatus(
      created.userId,
      {
        name: "Usuário Promovido",
        isSuperadmin: true,
        role: "superadmin",
        active: false,
      },
      adminUser
    );

    const [updated] = await db.select().from(users).where(eq(users.id, created.userId)).limit(1);
    assert.equal(updated.name, "Usuário Promovido");
    assert.equal(updated.isSuperadmin, true);
    assert.equal(updated.active, false);

    // Cleanup
    await db.delete(users).where(eq(users.id, created.userId));
  });

  it("4. deleteUser removes or deactivates user in MySQL", async () => {
    const [admin] = await db.select().from(users).where(eq(users.email, "studiodevstep@gmail.com")).limit(1);
    const adminUser = { id: admin?.id || "fallback-id", email: admin?.email || "admin@reservei.test" };
    const uniqueEmail = `test.del.${Date.now()}@reservei.test`;

    const created = await AdminService.createUserManual(
      {
        name: "Usuário Para Deletar",
        email: uniqueEmail,
        role: "customer",
      },
      adminUser
    );

    // Soft delete
    await AdminService.deleteUser(created.userId, "soft", "Teste soft delete", adminUser);
    const [softDeleted] = await db.select().from(users).where(eq(users.id, created.userId)).limit(1);
    assert.equal(softDeleted.active, false);
    assert.ok(softDeleted.deletedAt);

    // Hard delete
    await AdminService.deleteUser(created.userId, "hard", "Teste hard delete", adminUser);
    const [hardDeleted] = await db.select().from(users).where(eq(users.id, created.userId)).limit(1);
    assert.equal(hardDeleted, undefined);
  });
});
