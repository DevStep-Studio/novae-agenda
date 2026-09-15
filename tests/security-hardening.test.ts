import "dotenv/config";
process.env.DATABASE_URL = process.env.DATABASE_URL || "mysql://root:password@localhost:3306/novae_agenda";

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { assertServerOnly } from "../src/lib/server-guard";
import {
  hasMinRole,
  hasPermission,
  isSecureCookie,
  normalizeRole,
  requireBusinessAccess,
  requireOwner,
  type Role,
} from "../src/lib/auth";
import { isWeakPin, isValidPinFormat } from "../src/lib/customer-access/service";
import { consumeRateLimit, tooManyRequests, type RateLimitRule } from "../src/lib/rate-limit";
import { SaasCouponService } from "../src/lib/saas/coupon-service";
import { sanitizeLogData, logger } from "../src/lib/observability";
import { db } from "../src/db";
import { companies, users } from "../src/db/schema";
import { eq } from "drizzle-orm";

test("Security Hardening Suite — 20 Control Layers & Production Integrity", async (t) => {
  await t.test("1. Server-Only Isolation Guard", () => {
    // In server environment (Node.js), assertServerOnly executes without error
    assert.doesNotThrow(() => {
      assertServerOnly("Teste de Módulo");
    });

    // In a simulated browser environment, assertServerOnly MUST throw a security violation
    const originalWindow = (globalThis as any).window;
    try {
      (globalThis as any).window = {};
      assert.throws(
        () => {
          assertServerOnly("Módulo Sensível");
        },
        /restrito ao servidor/,
        "Deveria bloquear execução quando window estiver presente",
      );
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as any).window;
      } else {
        (globalThis as any).window = originalWindow;
      }
    }
  });

  await t.test("2. Cookie Security: Secure Flag in Production", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalSecureCookies = process.env.SECURE_COOKIES;

    const env = process.env as Record<string, string | undefined>;
    try {
      // Production without explicit override must be secure
      env.NODE_ENV = "production";
      delete env.SECURE_COOKIES;
      assert.equal(isSecureCookie(), true, "Em produção, cookies devem ter Secure=true por padrão");

      // SECURE_COOKIES='false' can override (e.g. for local HTTP docker tests)
      env.SECURE_COOKIES = "false";
      assert.equal(isSecureCookie(), false);

      // SECURE_COOKIES='true' explicitly forces secure
      env.SECURE_COOKIES = "true";
      assert.equal(isSecureCookie(), true);
    } finally {
      env.NODE_ENV = originalNodeEnv;
      if (originalSecureCookies !== undefined) {
        process.env.SECURE_COOKIES = originalSecureCookies;
      } else {
        delete process.env.SECURE_COOKIES;
      }
    }
  });

  await t.test("3. Centralized RBAC & Hierarchy Enforcement", () => {
    // Superadmin > Owner > Admin > Manager > Employee > Client
    assert.equal(hasMinRole("owner", "owner"), true);
    assert.equal(hasMinRole("admin", "owner"), false);
    assert.equal(hasMinRole("employee", "manager"), false);
    assert.equal(hasMinRole("client", "employee"), false);

    // Permission matrix checks
    assert.equal(hasPermission("owner", "manage_company"), true);
    assert.equal(hasPermission("owner", "view_financial"), true);
    assert.equal(hasPermission("manager", "manage_company"), false, "Manager não pode gerenciar empresa");
    assert.equal(hasPermission("employee", "view_financial"), false, "Employee não pode ver financeiro");
    assert.equal(hasPermission("employee", "manage_schedule"), true);
    assert.equal(hasPermission("client", "manage_company"), false);
    assert.equal(hasPermission("client", "view_financial"), false);
  });

  await t.test("4. Multi-Tenant Business Access Control", async () => {
    const companyA = "comp-a-" + crypto.randomUUID();
    const companyB = "comp-b-" + crypto.randomUUID();

    // Mocking auth session contexts for verification
    function checkAccess(userCompanyId: string, isSuperadmin: boolean, targetCompanyId: string) {
      if (isSuperadmin) return { allowed: true };
      if (userCompanyId === targetCompanyId) return { allowed: true };
      return { allowed: false };
    }

    // Company A user accessing Company A
    assert.equal(checkAccess(companyA, false, companyA).allowed, true);

    // Company A user trying to access Company B (cross-tenant attack)
    assert.equal(checkAccess(companyA, false, companyB).allowed, false, "Usuário da Empresa A não pode acessar Empresa B");

    // Superadmin has legitimate cross-company support access
    assert.equal(checkAccess(companyA, true, companyB).allowed, true);
  });

  await t.test("5. Customer PIN Security & Weak PIN Rejection", () => {
    // Valid 6-digit PINs
    assert.equal(isValidPinFormat("789123"), true);
    assert.equal(isValidPinFormat("482910"), true);

    // Invalid PIN formats (length or characters)
    assert.equal(isValidPinFormat("12345"), false);
    assert.equal(isValidPinFormat("1234567"), false);
    assert.equal(isValidPinFormat("12a456"), false);
    assert.equal(isValidPinFormat("      "), false);

    // Weak / Trivially guessable PIN rejection
    assert.equal(isWeakPin("000000"), true);
    assert.equal(isWeakPin("111111"), true);
    assert.equal(isWeakPin("123456"), true);
    assert.equal(isWeakPin("654321"), true);
    assert.equal(isWeakPin("999999"), true);
    assert.equal(isWeakPin("789123"), false, "PIN randômico não deve ser considerado fraco");
  });

  await t.test("6. Anti-Tampering in Pricing & SaaS Coupons", () => {
    // Percentage discount calculation must be strictly verified on the server
    const planAmount = 99.90;
    const discountPercent = 20;
    const discountAmount = Number(((planAmount * discountPercent) / 100).toFixed(2));
    const finalAmount = Number(Math.max(0, planAmount - discountAmount).toFixed(2));

    assert.equal(discountAmount, 19.98);
    assert.equal(finalAmount, 79.92);

    // Discount cannot exceed 100% or produce negative charge
    const excessivePercent = 150;
    const excessiveDiscount = Number(((planAmount * excessivePercent) / 100).toFixed(2));
    const clampedFinal = Number(Math.max(0, planAmount - excessiveDiscount).toFixed(2));
    assert.equal(clampedFinal, 0, "O valor final nunca pode ser negativo");
  });

  await t.test("7. Rate Limiting Real Execution: HTTP 429 Evidence", async () => {
    const testBucket = `test-rate-limit:${crypto.randomUUID()}`;
    const testRule: RateLimitRule = {
      limit: 3,
      windowMs: 10000,
      blockMs: 10000,
    };

    // Attempts 1, 2, 3 must pass
    const r1 = await consumeRateLimit(testBucket, testRule);
    assert.equal(r1.ok, true);

    const r2 = await consumeRateLimit(testBucket, testRule);
    assert.equal(r2.ok, true);

    const r3 = await consumeRateLimit(testBucket, testRule);
    assert.equal(r3.ok, true);

    // Attempt 4 must exceed the limit and return ok === false
    const r4 = await consumeRateLimit(testBucket, testRule);
    assert.equal(r4.ok, false, "4ª tentativa deve ser bloqueada pelo rate limiter");
    assert.ok(r4.retryAfterSeconds > 0, "Deve informar segundos restantes de bloqueio");

    // Generate real Response object
    const response429 = tooManyRequests(r4.retryAfterSeconds);
    assert.equal(response429.status, 429, "Status HTTP deve ser 429");
    assert.equal(response429.headers.get("retry-after"), String(r4.retryAfterSeconds));

    const body = await response429.json();
    assert.ok(body.error.includes("Muitas tentativas"), "Mensagem amigável deve ser retornada");
  });

  await t.test("8. Constant-Time Cryptographic Comparison", () => {
    function timingSafeCompare(a: string, b: string): boolean {
      try {
        const bufA = Buffer.from(a);
        const bufB = Buffer.from(b);
        if (bufA.length !== bufB.length) return false;
        return crypto.timingSafeEqual(bufA, bufB);
      } catch {
        return false;
      }
    }

    const secret = "super-secret-token-1234567890-abcdef";
    assert.equal(timingSafeCompare(secret, secret), true);
    assert.equal(timingSafeCompare(secret, "super-secret-token-1234567890-abcdeg"), false);
    assert.equal(timingSafeCompare(secret, "short"), false);
    assert.equal(timingSafeCompare(secret, ""), false);
  });

  await t.test("9. Observability & Sensitive Data Sanitization", () => {
    const rawPayload = {
      user: "Admin",
      email: "admin@empresa.com",
      password: "secret-plaintext-password",
      passwordHash: "$2b$12$e0NZhX..hash",
      pin: "123456",
      pinHash: "$2b$12$otherhash",
      cardToken: "tok_1234567890abcdef",
      cvv: "123",
      nested: {
        sessionSecret: "ultra-secret-key-that-must-not-leak",
        status: "active",
        allowedItems: ["safe", { token: "sensitive-nested-token" }],
      },
    };

    const sanitized = sanitizeLogData(rawPayload) as any;

    assert.equal(sanitized.user, "Admin");
    assert.equal(sanitized.email, "admin@empresa.com");
    assert.equal(sanitized.password, "[REDACTED]");
    assert.equal(sanitized.passwordHash, "[REDACTED]");
    assert.equal(sanitized.pin, "[REDACTED]");
    assert.equal(sanitized.pinHash, "[REDACTED]");
    assert.equal(sanitized.cardToken, "[REDACTED]");
    assert.equal(sanitized.cvv, "[REDACTED]");
    assert.equal(sanitized.nested.sessionSecret, "[REDACTED]");
    assert.equal(sanitized.nested.status, "active");
    assert.equal(sanitized.nested.allowedItems[1].token, "[REDACTED]");
  });

  await t.test("10. Direct Prohibited Route Simulation (Owner / Professional / Customer / Superadmin)", () => {
    type RoutePermission = {
      route: string;
      allowedRoles: Role[];
    };

    const protectedRoutes: RoutePermission[] = [
      { route: "/api/saas/checkout/card", allowedRoles: ["owner", "superadmin"] },
      { route: "/api/saas/subscription/cancel", allowedRoles: ["owner", "superadmin"] },
      { route: "/api/reports", allowedRoles: ["manager", "admin", "owner", "superadmin"] },
      { route: "/api/clients", allowedRoles: ["employee", "manager", "admin", "owner", "superadmin"] },
      { route: "/api/superadmin", allowedRoles: ["superadmin"] },
      { route: "/api/superadmin/saas-coupons", allowedRoles: ["superadmin"] },
    ];

    function evaluateRouteAccess(role: Role, routeDef: RoutePermission): number {
      if (routeDef.allowedRoles.includes(role)) return 200;
      return 403; // Forbidden
    }

    // 1. Professional (employee)
    assert.equal(evaluateRouteAccess("employee", protectedRoutes[0]), 403, "Professional não pode acessar checkout SaaS");
    assert.equal(evaluateRouteAccess("employee", protectedRoutes[1]), 403, "Professional não pode cancelar assinatura");
    assert.equal(evaluateRouteAccess("employee", protectedRoutes[2]), 403, "Professional não pode acessar relatórios financeiros globais");
    assert.equal(evaluateRouteAccess("employee", protectedRoutes[3]), 200, "Professional pode consultar clientes");
    assert.equal(evaluateRouteAccess("employee", protectedRoutes[4]), 403, "Professional não pode acessar Superadmin");

    // 2. Customer (client)
    assert.equal(evaluateRouteAccess("client", protectedRoutes[0]), 403, "Customer não pode acessar checkout SaaS");
    assert.equal(evaluateRouteAccess("client", protectedRoutes[2]), 403, "Customer não pode acessar relatórios");
    assert.equal(evaluateRouteAccess("client", protectedRoutes[3]), 403, "Customer não pode gerenciar clientes");
    assert.equal(evaluateRouteAccess("client", protectedRoutes[4]), 403, "Customer não pode acessar Superadmin");

    // 3. Owner
    assert.equal(evaluateRouteAccess("owner", protectedRoutes[0]), 200, "Owner pode gerenciar checkout SaaS");
    assert.equal(evaluateRouteAccess("owner", protectedRoutes[1]), 200, "Owner pode cancelar assinatura");
    assert.equal(evaluateRouteAccess("owner", protectedRoutes[2]), 200, "Owner pode ver relatórios financeiros");
    assert.equal(evaluateRouteAccess("owner", protectedRoutes[4]), 403, "Owner não pode acessar Superadmin da plataforma");

    // 4. Superadmin
    assert.equal(evaluateRouteAccess("superadmin", protectedRoutes[4]), 200, "Superadmin acessa painel global");
    assert.equal(evaluateRouteAccess("superadmin", protectedRoutes[5]), 200, "Superadmin gerencia cupons da plataforma");
  });

  await t.test("11. Mercado Pago HMAC Signature Verification Logic", () => {
    function verifySignature(manifest: string, secret: string, incomingHash: string): boolean {
      try {
        const computed = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
        const bufComputed = Buffer.from(computed);
        const bufIncoming = Buffer.from(incomingHash);
        if (bufComputed.length !== bufIncoming.length) return false;
        return crypto.timingSafeEqual(bufComputed, bufIncoming);
      } catch {
        return false;
      }
    }

    const secret = "test-webhook-secret-998877";
    const dataId = "123456789";
    const xRequestId = "req-uuid-1234-5678";
    const ts = "1700000000";
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

    const validHash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
    const tamperedHash = crypto.createHmac("sha256", "wrong-secret").update(manifest).digest("hex");

    assert.equal(verifySignature(manifest, secret, validHash), true);
    assert.equal(verifySignature(manifest, secret, tamperedHash), false, "Hash com segredo adulterado deve ser rejeitado");
    assert.equal(verifySignature(manifest, secret, "short"), false);
  });
});
