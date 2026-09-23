import test from "node:test";
import assert from "node:assert/strict";
import { db } from "@/db";
import { users, companies, companyMemberships, employees, services, bookings, clients } from "@/db/schema";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { GET as sessionRoute } from "@/app/api/auth/session/route";
import { hashPassword, verifyPassword, createSession, normalizeEmail } from "@/lib/auth";
import { eq } from "drizzle-orm";

test("Unified Web & Mobile — Zero Mock & Strict Account Parity Test Suite", async (t) => {
  await t.test("1. Login Rejection & Zero Auto-Provisioning (FASE 8 & 9)", async () => {
    const nonExistentEmail = `nonexistent_user_${Date.now()}@testfake.com`;
    const initialUserCount = (await db.select({ id: users.id }).from(users)).length;
    const initialCompCount = (await db.select({ id: companies.id }).from(companies)).length;

    const fakeReq = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: nonExistentEmail,
        password: "WrongPassword123!",
      }),
    });

    const res = await loginRoute(fakeReq);
    assert.equal(res.status, 401, "Non-existent user login must return 401 Unauthorized");

    const json = await res.json();
    assert.equal(json.error, "E-mail ou senha incorretos.");

    const finalUserCount = (await db.select({ id: users.id }).from(users)).length;
    const finalCompCount = (await db.select({ id: companies.id }).from(companies)).length;

    assert.equal(finalUserCount, initialUserCount, "No new user must be auto-created during login");
    assert.equal(finalCompCount, initialCompCount, "No new company must be auto-created during login");
  });

  await t.test("2. PL Barbearia — Account Context & Identity Integrity", async () => {
    const [plUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, "plbarbearia@gmail.com"))
      .limit(1);

    assert.ok(plUser, "PL Barbearia user must exist in MySQL");
    assert.equal(plUser.id, "26bbc3d7-0b00-4fe4-90b0-8c6fae1ad3f7");
    assert.equal(plUser.role, "owner");
    assert.equal(plUser.companyId, "6efccb96-07f1-4ff5-a6a9-770f1d46214f");

    const [plCompany] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, plUser.companyId!))
      .limit(1);

    assert.ok(plCompany, "PL Barbearia company must exist in MySQL");
    assert.equal(plCompany.id, "6efccb96-07f1-4ff5-a6a9-770f1d46214f");
    assert.equal(plCompany.name, "PL Barbearia");
    assert.equal(plCompany.publicSlug, "pl-barbearia");
    assert.equal(plCompany.primaryColor, "#8b5cf6");
  });

  await t.test("3. Moa Tattoo — Account Context & Multi-Entity Integrity", async () => {
    const [moaUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, "moa_tattooholic@gmail.com"))
      .limit(1);

    assert.ok(moaUser, "Moa Tattoo user must exist in MySQL");
    assert.equal(moaUser.id, "588c17d6-c94e-4ae6-8b5b-9372b33e8a95");
    assert.equal(moaUser.role, "owner");
    assert.equal(moaUser.companyId, "a6624dbd-0bd4-4e94-a746-0ee2718c8fac");

    const [moaCompany] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, moaUser.companyId!))
      .limit(1);

    assert.ok(moaCompany, "Moa Tattoo company must exist in MySQL");
    assert.equal(moaCompany.id, "a6624dbd-0bd4-4e94-a746-0ee2718c8fac");
    assert.equal(moaCompany.name, "Moa Tattoo");

    // Check employees linked to Moa Tattoo
    const moaEmployees = await db
      .select()
      .from(employees)
      .where(eq(employees.companyId, moaCompany.id));
    assert.ok(moaEmployees.length >= 2, "Moa Tattoo must have at least 2 employees");

    // Check services linked to Moa Tattoo
    const moaServices = await db
      .select()
      .from(services)
      .where(eq(services.companyId, moaCompany.id));
    assert.ok(moaServices.length > 0, "Moa Tattoo must have services in MySQL");
  });

  await t.test("4. Strict Tenant Isolation — Moa vs PL Data Separation", async () => {
    const [plUser] = await db.select().from(users).where(eq(users.email, "plbarbearia@gmail.com")).limit(1);
    const [moaUser] = await db.select().from(users).where(eq(users.email, "moa_tattooholic@gmail.com")).limit(1);

    assert.notEqual(plUser?.id, moaUser?.id, "User IDs must be distinct");
    assert.notEqual(plUser?.companyId, moaUser?.companyId, "Company IDs must be distinct");

    const plEmployees = await db.select().from(employees).where(eq(employees.companyId, plUser!.companyId!));
    const moaEmployees = await db.select().from(employees).where(eq(employees.companyId, moaUser!.companyId!));

    const plEmpIds = new Set(plEmployees.map((e) => e.id));
    const moaEmpIds = new Set(moaEmployees.map((e) => e.id));

    for (const id of plEmpIds) {
      assert.equal(moaEmpIds.has(id), false, `Employee ${id} must not belong to both companies`);
    }
  });
});
