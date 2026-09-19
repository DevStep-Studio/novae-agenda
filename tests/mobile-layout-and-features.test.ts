import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { formatBRL, formatPhoneForWhatsApp } from "../mobile/src/lib/formatters";

test("Mobile Layout & Functionality Suite — Visual, Resilience & Route Integrity", async (t) => {
  await t.test("1. formatBRL resilience across edge cases and malformed data", () => {
    // Standard numbers
    assert.match(formatBRL(100), /100/);
    assert.match(formatBRL(59.9), /59,90/);
    assert.match(formatBRL(0), /0,00/);

    // Strings and stringified numbers
    assert.match(formatBRL("150.50"), /150,50/);
    assert.match(formatBRL("invalid"), /0,00/);

    // Null and Undefined
    assert.match(formatBRL(null), /0,00/);
    assert.match(formatBRL(undefined), /0,00/);
    assert.match(formatBRL(NaN), /0,00/);
    assert.match(formatBRL(Infinity), /0,00/);
  });

  await t.test("2. WhatsApp link & phone sanitizer resilience", () => {
    assert.equal(formatPhoneForWhatsApp("(11) 98765-4321"), "5511987654321");
    assert.equal(formatPhoneForWhatsApp("+55 11 98765-4321"), "5511987654321");
    assert.equal(formatPhoneForWhatsApp("11987654321"), "5511987654321");
    assert.equal(formatPhoneForWhatsApp("5511987654321"), "5511987654321");
    assert.equal(formatPhoneForWhatsApp(null), "");
    assert.equal(formatPhoneForWhatsApp(undefined), "");
    assert.equal(formatPhoneForWhatsApp(""), "");
  });

  await t.test("3. Route integrity: All 10 owner sections in mais.tsx point to existing route files", () => {
    const ownerAppDir = path.resolve(process.cwd(), "mobile/src/app/(owner)");
    const expectedRoutes = [
      "equipe.tsx",
      "servicos.tsx",
      "financeiro.tsx",
      "relatorios.tsx",
      "avaliacoes.tsx",
      "lista-espera.tsx",
      "clubes.tsx",
      "notificacoes.tsx",
      "configuracoes.tsx",
      "assinatura.tsx",
    ];

    for (const routeFile of expectedRoutes) {
      const fullPath = path.join(ownerAppDir, routeFile);
      assert.ok(
        fs.existsSync(fullPath),
        `Route file ${routeFile} must exist in mobile/src/app/(owner)/`
      );
    }
  });

  await t.test("4. Screen existence for Customer and Employee roles", () => {
    const customerDir = path.resolve(process.cwd(), "mobile/src/app/(customer)");
    assert.ok(fs.existsSync(path.join(customerDir, "index.tsx")));
    assert.ok(fs.existsSync(path.join(customerDir, "mais.tsx")));
    assert.ok(fs.existsSync(path.join(customerDir, "_layout.tsx")));

    const employeeDir = path.resolve(process.cwd(), "mobile/src/app/(employee)");
    assert.ok(fs.existsSync(path.join(employeeDir, "index.tsx")));
    assert.ok(fs.existsSync(path.join(employeeDir, "mais.tsx")));
    assert.ok(fs.existsSync(path.join(employeeDir, "_layout.tsx")));

    const authDir = path.resolve(process.cwd(), "mobile/src/app/(auth)");
    assert.ok(fs.existsSync(path.join(authDir, "login.tsx")));
    assert.ok(fs.existsSync(path.join(authDir, "customer-access.tsx")));
  });

  await t.test("5. Design Tokens source file integrity", () => {
    const tokensPath = path.resolve(process.cwd(), "mobile/src/constants/design-tokens.ts");
    assert.ok(fs.existsSync(tokensPath), "design-tokens.ts must exist");
    const content = fs.readFileSync(tokensPath, "utf-8");
    assert.match(content, /#dcff4c/, "Primary lime color #dcff4c must be present");
    assert.match(content, /#080808/, "Dark background #080808 must be present");
    assert.match(content, /#121212/, "Dark surface #121212 must be present");
    assert.match(content, /DMSans_700Bold/, "Brand typography must be defined");
  });
});
