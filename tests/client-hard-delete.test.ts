import "dotenv/config";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  appointments,
  clients,
  companies,
  employees,
  locations,
  users,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth";

describe("Client Hard Deletion from Database Test Suite", () => {
  let testCompanyId: string;
  let testOwnerUserId: string;
  let testLocationId: string;
  let testEmployeeId: string;
  let testOwnerEmail: string;
  const testPassword = "Password123!Safe";
  let cookieHeader: string = "";

  before(async () => {
    testCompanyId = randomUUID();
    testOwnerUserId = randomUUID();
    testLocationId = randomUUID();
    testEmployeeId = randomUUID();
    testOwnerEmail = `owner-${randomUUID().slice(0, 8)}@test.com`;

    // Setup company
    await db.insert(companies).values({
      id: testCompanyId,
      name: "Empresa Teste Hard Delete",
      businessType: "Barbearia",
      publicSlug: "slug-" + randomUUID().slice(0, 8),
    });

    const passHash = await hashPassword(testPassword);

    // Setup owner user
    await db.insert(users).values({
      id: testOwnerUserId,
      email: testOwnerEmail,
      companyId: testCompanyId,
      role: "owner",
      name: "Owner Teste",
      passwordHash: passHash,
      active: true,
    });

    // Setup location
    await db.insert(locations).values({
      id: testLocationId,
      companyId: testCompanyId,
      name: "Unidade Principal",
    });

    // Setup employee
    await db.insert(employees).values({
      id: testEmployeeId,
      companyId: testCompanyId,
      name: "Profissional Teste",
      jobTitle: "Atendente",
    });

    // Login via API to obtain authenticated session cookies
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
    await db.delete(employees).where(eq(employees.companyId, testCompanyId)).catch(() => {});
    await db.delete(locations).where(eq(locations.companyId, testCompanyId)).catch(() => {});
    await db.delete(users).where(eq(users.companyId, testCompanyId)).catch(() => {});
    await db.delete(companies).where(eq(companies.id, testCompanyId)).catch(() => {});
    await pool.end();
  });

  it("permanently hard-deletes client and dependencies from the database", async () => {
    const clientId = randomUUID();
    const apptId = randomUUID();

    // 1. Insert client
    await db.insert(clients).values({
      id: clientId,
      companyId: testCompanyId,
      name: "Cliente Para Excluir Definitivamente",
      phone: "11999998888",
      email: "cliente.delete@test.com",
      active: true,
    });

    // 2. Insert related appointment
    await db.insert(appointments).values({
      id: apptId,
      companyId: testCompanyId,
      clientId,
      employeeId: testEmployeeId,
      locationId: testLocationId,
      appointmentDate: "2026-09-25",
      startTime: "14:00:00",
      endTime: "15:00:00",
      total: "80.00",
      status: "scheduled",
    });

    // Verify it exists in DB before delete
    const [beforeClient] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.companyId, testCompanyId)));
    assert.ok(beforeClient, "Cliente deve existir no banco de dados antes da exclusão");

    // 3. Call DELETE /api/clients/[id]
    const delRes = await fetch(`http://localhost:3000/api/clients/${clientId}`, {
      method: "DELETE",
      headers: {
        Cookie: cookieHeader,
      },
    });

    assert.equal(delRes.status, 200, "DELETE deve retornar 200 OK");
    const body = await delRes.json();
    assert.equal(body.data.id, clientId);

    // 4. Verify client is COMPLETELY REMOVED from database (not just soft-deleted or anonymized)
    const [afterClient] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId));
    assert.equal(afterClient, undefined, "Cliente deve ser removido fisicamente do banco de dados");

    // 5. Verify appointment was also deleted/cascaded
    const [afterAppt] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, apptId));
    assert.equal(afterAppt, undefined, "Agendamento vinculado deve ser removido do banco");

    // 6. Verify client is not returned in GET /api/clients
    const listRes = await fetch("http://localhost:3000/api/clients", {
      headers: {
        Cookie: cookieHeader,
      },
    });
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    const items = Array.isArray(listBody) ? listBody : (listBody.data || []);
    const foundInList = items.find((c: any) => c.id === clientId);
    assert.equal(foundInList, undefined, "Cliente não deve constar na listagem de clientes");
  });
});
