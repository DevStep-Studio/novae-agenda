import "dotenv/config";
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { AdminService } from "@/lib/admin/admin-service";
import { db } from "@/db";
import { users, customerCredentials } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth";

describe("Super Admin — User PINs Management Suite (Direct MySQL)", () => {
  let testUserId = "";
  const testEmail = `pin.test.${Date.now()}@reservei.test`;
  let adminUser = { id: "", email: "studiodevstep@gmail.com" };

  after(async () => {
    if (testUserId) {
      await db.delete(customerCredentials).where(eq(customerCredentials.userId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it("1. listUserPins returns users with PIN credentials and stats", async () => {
    const [admin] = await db.select().from(users).where(eq(users.email, "studiodevstep@gmail.com")).limit(1);
    if (admin) {
      adminUser = { id: admin.id, email: admin.email };
    }
    const res = await AdminService.listUserPins({ page: 1, limit: 20 });
    assert.ok(res.pagination.total >= 1, "Should have users in database");
    assert.ok(res.items.length >= 1, "Should return items");
    assert.ok(res.stats, "Should return stats object");
    assert.ok(typeof res.stats.totalUsers === "number", "totalUsers must be a number");
    assert.ok(typeof res.stats.configuredPins === "number", "configuredPins must be a number");
    assert.ok(typeof res.stats.unconfiguredPins === "number", "unconfiguredPins must be a number");
  });

  it("2. resetUserPin generates and sets PIN for user in MySQL", async () => {
    const newUser = await AdminService.createUserManual(
      {
        name: "Usuário Teste PIN",
        email: testEmail,
        phone: "(11) 98765-4321",
        role: "customer",
      },
      adminUser
    );
    testUserId = newUser.userId;

    // Reset PIN with auto-generation
    const resetRes = await AdminService.resetUserPin(
      testUserId,
      { unlock: true },
      adminUser
    );

    assert.equal(resetRes.success, true);
    assert.ok(resetRes.pin, "Must return generated PIN");
    assert.match(resetRes.pin, /^\d{6}$/, "Generated PIN must be 6 digits");
    assert.equal(resetRes.userId, testUserId);

    // Verify in database customer_credentials
    const [cred] = await db
      .select()
      .from(customerCredentials)
      .where(eq(customerCredentials.userId, testUserId))
      .limit(1);

    assert.ok(cred, "Customer credential must exist in MySQL");
    assert.equal(cred.failedAttempts, 0);
    assert.equal(cred.lockedUntil, null);

    // Verify PIN matches hash
    const isValid = await verifyPassword(resetRes.pin, cred.pinHash);
    assert.equal(isValid, true, "PIN must verify against stored hash");

    // Verify in listUserPins
    const pinsList = await AdminService.listUserPins({ q: testEmail });
    assert.equal(pinsList.items.length, 1);
    assert.equal(pinsList.items[0].hasPin, true);
    assert.equal(pinsList.items[0].isLocked, false);
  });

  it("3. resetUserPin accepts manual valid PIN and rejects weak PIN", async () => {
    // Reject weak PIN
    await assert.rejects(
      AdminService.resetUserPin(testUserId, { pin: "123456" }, adminUser),
      /muito fraco/
    );

    // Accept valid manual PIN
    const customPin = "849201";
    const resetRes = await AdminService.resetUserPin(
      testUserId,
      { pin: customPin },
      adminUser
    );

    assert.equal(resetRes.success, true);
    assert.equal(resetRes.pin, customPin);

    // Verify updated hash
    const [cred] = await db
      .select()
      .from(customerCredentials)
      .where(eq(customerCredentials.userId, testUserId))
      .limit(1);

    const isValid = await verifyPassword(customPin, cred.pinHash);
    assert.equal(isValid, true);
  });

  it("4. unlockUserPin unlocks locked user and resets failed attempts", async () => {
    // Simulate locked user
    const futureDate = new Date(Date.now() + 3600000);
    await db
      .update(customerCredentials)
      .set({ failedAttempts: 5, lockedUntil: futureDate })
      .where(eq(customerCredentials.userId, testUserId));

    const lockedList = await AdminService.listUserPins({ q: testEmail });
    assert.equal(lockedList.items[0].isLocked, true);
    assert.equal(lockedList.items[0].failedAttempts, 5);

    // Unlock
    const unlockRes = await AdminService.unlockUserPin(testUserId, adminUser);
    assert.equal(unlockRes.success, true);

    const unlockedList = await AdminService.listUserPins({ q: testEmail });
    assert.equal(unlockedList.items[0].isLocked, false);
    assert.equal(unlockedList.items[0].failedAttempts, 0);
  });

  it("5. removeUserPin removes credential from MySQL", async () => {
    const removeRes = await AdminService.removeUserPin(testUserId, adminUser);
    assert.equal(removeRes.success, true);

    const afterList = await AdminService.listUserPins({ q: testEmail });
    assert.equal(afterList.items[0].hasPin, false);
  });
});
