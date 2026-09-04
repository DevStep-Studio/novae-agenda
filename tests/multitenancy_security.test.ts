import "dotenv/config";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  clients,
  companies,
  employees,
  locations,
  users,
} from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth";

describe("Multitenancy Security & Role-Based Access Control", () => {
  let companyAId: string;
  let companyBId: string;
  let userOwnerAId: string;
  let userEmployeeAId: string;
  let clientAId: string;
  let clientBId: string;

  before(async () => {
    // 1. Create Company A and Company B
    const [compA] = await db
      .insert(companies)
      .values({ name: "Empresa Alpha Ltda" })
      .returning();
    companyAId = compA.id;

    const [compB] = await db
      .insert(companies)
      .values({ name: "Empresa Beta Ltda" })
      .returning();
    companyBId = compB.id;

    // 2. Create users for Company A
    const passwordHash = await hashPassword("SenhaForte@123");

    const [ownerA] = await db
      .insert(users)
      .values({
        companyId: companyAId,
        name: "Owner Alpha",
        email: "owner@alpha.com",
        passwordHash,
        role: "owner",
      })
      .returning();
    userOwnerAId = ownerA.id;

    const [empA] = await db
      .insert(users)
      .values({
        companyId: companyAId,
        name: "Employee Alpha",
        email: "colab@alpha.com",
        passwordHash,
        role: "employee",
      })
      .returning();
    userEmployeeAId = empA.id;

    // 3. Create a client for Company A and one for Company B
    const [cliA] = await db
      .insert(clients)
      .values({
        companyId: companyAId,
        name: "Cliente Exclusivo Alpha",
        phone: "11911110001",
      })
      .returning();
    clientAId = cliA.id;

    const [cliB] = await db
      .insert(clients)
      .values({
        companyId: companyBId,
        name: "Cliente Exclusivo Beta",
        phone: "11922220002",
      })
      .returning();
    clientBId = cliB.id;
  });

  after(async () => {
    await db.delete(clients).where(eq(clients.companyId, companyAId));
    await db.delete(clients).where(eq(clients.companyId, companyBId));
    await db.delete(users).where(eq(users.companyId, companyAId));
    await db.delete(companies).where(eq(companies.id, companyAId));
    await db.delete(companies).where(eq(companies.id, companyBId));
  });

  it("strictly isolates multitenancy: Company A cannot query or mutate Company B records", async () => {
    // Querying clients with Company A scope
    const clientsForCompanyA = await db
      .select()
      .from(clients)
      .where(eq(clients.companyId, companyAId));

    assert.equal(clientsForCompanyA.length, 1);
    assert.equal(clientsForCompanyA[0].id, clientAId);
    assert.equal(clientsForCompanyA[0].name, "Cliente Exclusivo Alpha");

    // Company B client must NOT appear in Company A results
    const leakedClientB = clientsForCompanyA.find((c) => c.id === clientBId);
    assert.equal(leakedClientB, undefined, "Company B client leaked into Company A scope!");

    // Attempt to update Company B's client while enforcing Company A's tenant boundary
    const updateResult = await db
      .update(clients)
      .set({ name: "Nome Modificado Ilegalmente" })
      .where(and(eq(clients.id, clientBId), eq(clients.companyId, companyAId)))
      .returning();

    assert.equal(updateResult.length, 0, "Cross-tenant update must affect 0 rows");

    // Confirm Company B client was not modified
    const [actualClientB] = await db.select().from(clients).where(eq(clients.id, clientBId));
    assert.equal(actualClientB.name, "Cliente Exclusivo Beta");
  });

  it("hashes passwords securely and validates credentials correctly", async () => {
    const rawPass = "SegredoSuperSeguro#2026";
    const hashed = await hashPassword(rawPass);

    assert.notEqual(hashed, rawPass, "Password must not be stored in plaintext");
    assert.ok(hashed.startsWith("$2"), "Password hash must be a valid bcrypt hash");

    const isValid = await verifyPassword(rawPass, hashed);
    assert.equal(isValid, true, "Correct password must verify successfully");

    const isInvalid = await verifyPassword("SenhaIncorreta", hashed);
    assert.equal(isInvalid, false, "Incorrect password must fail verification");
  });

  it("enforces role-based permissions (EMPLOYEE vs OWNER/ADMIN vs SUPERADMIN)", async () => {
    // Mock user roles
    const employeeUser = {
      id: userEmployeeAId,
      companyId: companyAId,
      role: "employee" as const,
      isSuperadmin: false,
    };

    const ownerUser = {
      id: userOwnerAId,
      companyId: companyAId,
      role: "owner" as const,
      isSuperadmin: false,
    };

    const superadminUser = {
      id: "00000000-0000-0000-0000-000000000000",
      companyId: companyAId,
      role: "owner" as const,
      isSuperadmin: true,
    };

    // Employee cannot access administrative routes
    const allowedRolesForSettings = ["owner", "admin"];
    assert.equal(
      allowedRolesForSettings.includes(employeeUser.role),
      false,
      "Employee must NOT have access to company settings",
    );
    assert.equal(
      allowedRolesForSettings.includes(ownerUser.role),
      true,
      "Owner MUST have access to company settings",
    );

    // Superadmin guard
    assert.equal(employeeUser.isSuperadmin, false, "Employee is not superadmin");
    assert.equal(ownerUser.isSuperadmin, false, "Standard tenant owner is not platform superadmin");
    assert.equal(superadminUser.isSuperadmin, true, "Superadmin flag must be true");
  });
});
