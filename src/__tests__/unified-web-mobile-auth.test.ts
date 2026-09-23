import test from "node:test";
import assert from "node:assert/strict";
import { db } from "@/db";
import { users, companies, companyMemberships, customerCredentials, employees, services, bookings } from "@/db/schema";
import { CustomerAccessService, hashPinLookup } from "@/lib/customer-access/service";
import { createSession, hashPassword, verifyPassword, getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";

test("Unified Web & Mobile Architecture — Auth, PIN & Multi-tenant Parity", async (t) => {
  await t.test("1. Owner Identity Resolution & Company Context Consistency", async () => {
    // 1. Fetch official owner in DB ("Moa Tattoo")
    const [ownerUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, "moa_tattooholic@gmail.com"))
      .limit(1);

    assert.ok(ownerUser, "Owner user should exist in MySQL");
    assert.equal(ownerUser.role, "owner");
    assert.ok(ownerUser.companyId, "Owner user must be linked to a companyId");

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, ownerUser.companyId!))
      .limit(1);

    assert.ok(company, "Company must exist in MySQL");
    assert.equal(company.name, "Moa Tattoo");

    // Check company memberships
    const [membership] = await db
      .select()
      .from(companyMemberships)
      .where(eq(companyMemberships.userId, ownerUser.id))
      .limit(1);

    assert.ok(membership, "Company membership must exist for owner");
    assert.equal(membership.companyId, ownerUser.companyId);
    assert.equal(membership.role, "owner");

    // Verify professionals / employees for this company
    const compEmployees = await db
      .select()
      .from(employees)
      .where(eq(employees.companyId, ownerUser.companyId!));

    assert.ok(compEmployees.length >= 2, "Company must have at least 2 professionals");
    const names = compEmployees.map((e) => e.name);
    assert.ok(names.includes("Marlon") || names.includes("Júlio Queiroz"));
  });

  await t.test("2. Customer PIN Authentication & Universal Service Parity", async () => {
    // Check customer credentials in MySQL
    const creds = await db.select().from(customerCredentials);
    assert.ok(creds.length > 0, "Customer credentials must exist in MySQL");

    // Pick a test customer credential
    const targetCred = creds.find((c) => c.phoneNormalized && c.phoneNormalized.length >= 8) || creds[0];
    assert.ok(targetCred, "A customer credential must be available");

    // Test password hashing and verification with a valid test PIN
    const testPin = "654321";
    const testPinHash = await hashPassword(testPin);
    const testPinLookupHash = hashPinLookup(testPin);

    await db
      .update(customerCredentials)
      .set({
        pinHash: testPinHash,
        pinLookupHash: testPinLookupHash,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(customerCredentials.id, targetCred.id));

    // Test direct PIN-only login via CustomerAccessService (used by both Web & Mobile backend endpoints)
    const result = await CustomerAccessService.loginWithPin({
      pin: testPin,
      ipAddress: "127.0.0.1",
      userAgent: "UnifiedTest/1.0",
    });

    assert.ok(result, "loginWithPin should succeed");
    assert.equal(result.userId, targetCred.userId);
    assert.equal(result.customer.role, "customer");
    assert.equal(result.customer.hasPin, true);

    // Verify invalid PIN is rejected consistently
    await assert.rejects(
      async () => {
        await CustomerAccessService.loginWithPin({
          pin: "000000",
          ipAddress: "127.0.0.1",
          userAgent: "UnifiedTest/1.0",
        });
      },
      /PIN/i
    );
  });
});
