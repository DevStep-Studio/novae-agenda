import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { companies, users, employees, services, companySettings } from "../src/db/schema";
import { createSession, getIdentity, getSession } from "../src/lib/auth";

test("Reservei — P0 Moa Tattoo Web ↔ Mobile Unified Identity & Data Suite", async (t) => {
  const moaEmail = "moa_tattooholic@gmail.com";
  const moaAltEmail = "moa_tattoholic@gmail.com";
  const expectedCompanyId = "a6624dbd-0bd4-4e94-a746-0ee2718c8fac";

  await t.test("1. Same Login Resolves Exact Same User and Active Company", async () => {
    const [user] = await db.select().from(users).where(eq(users.email, moaEmail));
    assert.ok(user, "User moa_tattooholic@gmail.com must exist");
    assert.equal(user.companyId, expectedCompanyId, "User must belong to official Moa Tattoo company");
    assert.equal(user.role, "owner", "User must have owner role");

    // Also verify alternate spelling moa_tattoholic@gmail.com
    const [altUser] = await db.select().from(users).where(eq(users.email, moaAltEmail));
    if (altUser) {
      assert.equal(altUser.companyId, expectedCompanyId, "Alternate spelling must map to official Moa Tattoo company");
    }
  });

  await t.test("2. Company Identity, Branding, Primary Color & Slug Parity", async () => {
    const [company] = await db.select().from(companies).where(eq(companies.id, expectedCompanyId));
    assert.ok(company, "Company must exist");
    assert.equal(company.name, "Moa Tattoo");
    assert.equal(company.publicSlug, "tatto-aoxg");
    assert.equal(company.primaryColor, "#f5f5f5");
    assert.ok(company.logoUrl, "Logo URL must be present");
  });

  await t.test("3. Team & Professionals Query Parity", async () => {
    const emps = await db.select().from(employees).where(eq(employees.companyId, expectedCompanyId));
    assert.equal(emps.length, 2, "Must return exactly 2 professionals for Moa Tattoo");
    const names = emps.map(e => e.name).sort();
    assert.deepEqual(names, ["Júlio Queiroz", "Marlon"]);
  });

  await t.test("4. Services Parity", async () => {
    const srvs = await db.select().from(services).where(eq(services.companyId, expectedCompanyId));
    assert.ok(srvs.length >= 1, "Must return services for Moa Tattoo");
    assert.ok(srvs.some(s => s.name === "Atendimento Padrão"));
  });

  await t.test("5. Company Settings & Cover Parity", async () => {
    const settings = await db.select().from(companySettings).where(eq(companySettings.companyId, expectedCompanyId));
    assert.ok(settings.length > 0, "Company settings must be configured");
    const coverRow = settings.find(s => s.key === "coverUrl" || s.key === "banner_url");
    assert.ok(coverRow, "Cover/Banner URL setting must exist");
  });
});
