import "dotenv/config";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  services,
  employeeServices,
  employees,
  locations,
  companies,
  users,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth";

describe("Service Deletion Test Suite (Direct MySQL & API)", () => {
  let testCompanyId: string;
  let otherCompanyId: string;
  let testOwnerUserId: string;
  let testEmployeeId: string;
  let testLocationId: string;
  let testOwnerEmail: string;
  const testPassword = "Password123!Safe";
  let cookieHeader: string = "";

  before(async () => {
    testCompanyId = randomUUID();
    otherCompanyId = randomUUID();
    testOwnerUserId = randomUUID();
    testEmployeeId = randomUUID();
    testLocationId = randomUUID();
    testOwnerEmail = `owner-${randomUUID().slice(0, 8)}@test.com`;

    // Setup main company
    await db.insert(companies).values({
      id: testCompanyId,
      name: "Empresa Teste Exclusao Servico",
      businessType: "Barbearia",
      publicSlug: "slug-" + randomUUID().slice(0, 8),
    });

    // Setup second company for tenant isolation test
    await db.insert(companies).values({
      id: otherCompanyId,
      name: "Outra Empresa",
      businessType: "Estética",
      publicSlug: "slug-" + randomUUID().slice(0, 8),
    });

    const passHash = await hashPassword(testPassword);

    // Setup owner user
    await db.insert(users).values({
      id: testOwnerUserId,
      email: testOwnerEmail,
      companyId: testCompanyId,
      role: "owner",
      name: "Owner Servicos",
      passwordHash: passHash,
      active: true,
    });

    // Setup employee
    await db.insert(employees).values({
      id: testEmployeeId,
      companyId: testCompanyId,
      name: "Barbeiro Teste",
      jobTitle: "Barbeiro",
    });

    // Login via API to obtain session cookies
    const loginRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testOwnerEmail,
        password: testPassword,
      }),
    });

    assert.equal(loginRes.status, 200, "Login do owner deve ser bem sucedido");
    const rawCookies = loginRes.headers.get("set-cookie") || "";
    const cookieParts = rawCookies.split(",").map((c) => c.split(";")[0].trim());
    cookieHeader = cookieParts.join("; ");
  });

  after(async () => {
    await db.delete(employeeServices).where(eq(employeeServices.employeeId, testEmployeeId)).catch(() => {});
    await db.delete(employees).where(eq(employees.companyId, testCompanyId)).catch(() => {});
    await db.delete(services).where(eq(services.companyId, testCompanyId)).catch(() => {});
    await db.delete(services).where(eq(services.companyId, otherCompanyId)).catch(() => {});
    await db.delete(users).where(eq(users.companyId, testCompanyId)).catch(() => {});
    await db.delete(companies).where(eq(companies.id, testCompanyId)).catch(() => {});
    await db.delete(companies).where(eq(companies.id, otherCompanyId)).catch(() => {});
    await pool.end();
  });

  it("successfully deletes a service and its relations from MySQL", async () => {
    const serviceId = randomUUID();

    // 1. Insert service
    await db.insert(services).values({
      id: serviceId,
      companyId: testCompanyId,
      name: "Corte Teste Para Excluir",
      price: "45.00",
      durationMinutes: 30,
      active: true,
    });

    // 2. Link to employee
    await db.insert(employeeServices).values({
      employeeId: testEmployeeId,
      serviceId: serviceId,
    });

    // Verify it exists in DB
    const [inserted] = await db.select().from(services).where(eq(services.id, serviceId));
    assert.ok(inserted, "Serviço deve ter sido inserido no banco");

    // 3. Call DELETE API
    const res = await fetch(`http://localhost:3000/api/services/${serviceId}`, {
      method: "DELETE",
      headers: {
        Cookie: cookieHeader,
      },
    });

    assert.equal(res.status, 200, "DELETE deve retornar status 200");
    const body = await res.json();
    assert.equal(body.data?.id, serviceId);

    // 4. Verify hard deletion in DB
    const [afterDelete] = await db.select().from(services).where(eq(services.id, serviceId));
    assert.equal(afterDelete, undefined, "Serviço deve ter sido removido do MySQL");

    // 5. Verify employee link was cascade-deleted
    const links = await db.select().from(employeeServices).where(eq(employeeServices.serviceId, serviceId));
    assert.equal(links.length, 0, "Relação com funcionários deve ter sido removida");
  });

  it("prevents deleting a service from another company (multi-tenant guard)", async () => {
    const foreignServiceId = randomUUID();

    await db.insert(services).values({
      id: foreignServiceId,
      companyId: otherCompanyId,
      name: "Servico Outra Empresa",
      price: "100.00",
      durationMinutes: 60,
      active: true,
    });

    const res = await fetch(`http://localhost:3000/api/services/${foreignServiceId}`, {
      method: "DELETE",
      headers: {
        Cookie: cookieHeader,
      },
    });

    assert.equal(res.status, 404, "Não deve permitir excluir serviço de outra empresa");

    // Confirm it is still in the DB
    const [foreign] = await db.select().from(services).where(eq(services.id, foreignServiceId));
    assert.ok(foreign, "Serviço de outra empresa deve continuar intacto");
  });

  it("returns error for invalid UUIDs", async () => {
    const res = await fetch("http://localhost:3000/api/services/invalid-id-123", {
      method: "DELETE",
      headers: {
        Cookie: cookieHeader,
      },
    });

    assert.ok([400, 404].includes(res.status), "ID inválido deve retornar 400 ou 404");
  });
});
