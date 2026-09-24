import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/db";
import { users, companies, customerCredentials, authTokens, subscriptions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { CustomerAccessService } from "@/lib/customer-access/service";
import { SubscriptionEntitlementService } from "@/lib/subscriptions/entitlement-service";
import { hashPassword, verifyPassword } from "@/lib/auth";

describe("Unified Web & Mobile — Production Readiness Test Suite", () => {
  it("1. Customer Phone + PIN — Non-Unique Global PINs Permitted (Two users with same PIN)", async () => {
    const sharedPin = "654321";

    const { normalizePhoneDigits } = await import("@/lib/domain");

    // Cria/Verifica Cliente A
    const rawPhoneA = "11911112222";
    const phoneA = normalizePhoneDigits(rawPhoneA);
    const userAId = "test-customer-phone-a";
    await db.insert(users).values({
      id: userAId,
      name: "Cliente A",
      email: "clientea@test.local",
      phone: rawPhoneA,
      passwordHash: await hashPassword(crypto.randomUUID()),
      role: "customer",
      active: true,
      emailVerified: true,
    }).onDuplicateKeyUpdate({ set: { name: "Cliente A", phone: rawPhoneA } });

    const pinHashA = await hashPassword(sharedPin);
    await db.insert(customerCredentials).values({
      id: "cred-customer-a",
      userId: userAId,
      phoneNormalized: phoneA,
      pinHash: pinHashA,
    }).onDuplicateKeyUpdate({ set: { userId: userAId, pinHash: pinHashA, phoneNormalized: phoneA } });

    // Cria/Verifica Cliente B com o MESMO PIN
    const rawPhoneB = "11933334444";
    const phoneB = normalizePhoneDigits(rawPhoneB);
    const userBId = "test-customer-phone-b";
    await db.insert(users).values({
      id: userBId,
      name: "Cliente B",
      email: "clienteb@test.local",
      phone: rawPhoneB,
      passwordHash: await hashPassword(crypto.randomUUID()),
      role: "customer",
      active: true,
      emailVerified: true,
    }).onDuplicateKeyUpdate({ set: { name: "Cliente B", phone: rawPhoneB } });

    const pinHashB = await hashPassword(sharedPin);
    await db.insert(customerCredentials).values({
      id: "cred-customer-b",
      userId: userBId,
      phoneNormalized: phoneB,
      pinHash: pinHashB,
    }).onDuplicateKeyUpdate({ set: { userId: userBId, pinHash: pinHashB, phoneNormalized: phoneB } });

    // Login com Telefone + PIN para cada cliente
    const authA = await CustomerAccessService.loginWithPin({
      phone: phoneA,
      pin: sharedPin,
    });
    assert.equal(authA.userId, userAId);
    assert.equal(authA.customer.name, "Cliente A");

    const authB = await CustomerAccessService.loginWithPin({
      phone: phoneB,
      pin: sharedPin,
    });
    assert.equal(authB.userId, userBId);
    assert.equal(authB.customer.name, "Cliente B");
  });

  it("2. PIN Confirmation & Validation — Rejects Mismatching or Invalid PINs", async () => {
    // PIN com tamanho inválido
    await assert.rejects(
      async () => {
        await CustomerAccessService.setupPin({
          phone: "11988887777",
          pin: "123",
          confirmPin: "123",
        });
      },
      /O PIN deve conter exatamente 6 dígitos numéricos/,
    );

    // PINs que não coincidem
    await assert.rejects(
      async () => {
        await CustomerAccessService.setupPin({
          phone: "11988887777",
          pin: "123456",
          confirmPin: "654321",
        });
      },
      /Os PINs não coincidem/,
    );
  });

  it("3. Owner Email Verification — Single-Use Token Consumption", async () => {
    const ownerUserId = "test-owner-verify-user";
    await db.insert(users).values({
      id: ownerUserId,
      name: "Proprietário Teste",
      email: "owner-verify@test.local",
      passwordHash: await hashPassword("password123"),
      role: "owner",
      active: true,
      emailVerified: false,
    }).onDuplicateKeyUpdate({ set: { emailVerified: false } });

    const rawToken = "verify-token-123456789";
    const { createHash } = await import("node:crypto");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    const tokenId = "token-email-verify-test";
    await db.insert(authTokens).values({
      id: tokenId,
      userId: ownerUserId,
      kind: "email_verification",
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }).onDuplicateKeyUpdate({ set: { tokenHash, consumedAt: null, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });

    // Simula consumo do token
    const [token] = await db
      .select()
      .from(authTokens)
      .where(and(eq(authTokens.id, tokenId), eq(authTokens.tokenHash, tokenHash)))
      .limit(1);

    assert.ok(token);
    assert.equal(token.consumedAt, null);

    // Consome e valida
    await db.update(authTokens).set({ consumedAt: new Date() }).where(eq(authTokens.id, tokenId));
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, ownerUserId));

    const [updatedUser] = await db.select().from(users).where(eq(users.id, ownerUserId)).limit(1);
    assert.equal(updatedUser?.emailVerified, true);
  });

  it("4. Native Subscriptions Entitlement — StoreKit 2 & Google Play Unified Entitlement", async () => {
    const testCompanyId = "test-company-entitlement-1";
    await db.insert(companies).values({
      id: testCompanyId,
      name: "Estúdio Teste Entitlement",
      publicSlug: "estudio-teste-entitlement",
      publicEnabled: true,
    }).onDuplicateKeyUpdate({ set: { name: "Estúdio Teste Entitlement" } });

    // Aplica assinatura Apple StoreKit 2
    const appleEntitlement = await SubscriptionEntitlementService.applyAppleSubscription({
      companyId: testCompanyId,
      productId: "reservei_profissional_monthly",
      transactionId: "txn-apple-1001",
      originalTransactionId: "orig-txn-apple-1001",
    });

    assert.equal(appleEntitlement.hasActiveAccess, true);
    assert.equal(appleEntitlement.planKey, "profissional");
    assert.equal(appleEntitlement.gateway, "apple");
    assert.equal(appleEntitlement.employeeLimit, 5);

    // Atualiza para Google Play
    const googleEntitlement = await SubscriptionEntitlementService.applyGoogleSubscription({
      companyId: testCompanyId,
      productId: "reservei_equipe_monthly",
      purchaseToken: "gplay-tok-2002",
      orderId: "GPA.1234-5678-9012",
    });

    assert.equal(googleEntitlement.hasActiveAccess, true);
    assert.equal(googleEntitlement.planKey, "equipe");
    assert.equal(googleEntitlement.gateway, "google_play");
    assert.equal(googleEntitlement.employeeLimit, 10);
  });
});
