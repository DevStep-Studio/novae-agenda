import "dotenv/config";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { clients, appointments, users, companies } from "@/db/schema";
import { createBooking } from "@/lib/booking/service";
import { bookingFixture, cleanupFixture, type Fixture } from "./booking-fixture";

describe("Client Auto Registration on Booking (Web & Mobile Sync)", () => {
  let f: Fixture;

  before(async () => {
    f = await bookingFixture();
  });

  after(async () => {
    if (f) await cleanupFixture(f);
    await pool.end();
  });

  it("automatically creates an active client in the barber CRM when a reservation is placed", async () => {
    const uniquePhone = "11987654321";
    const customerUser = {
      ...f.customers[0],
      id: randomUUID(),
      name: "Cliente Auto Cadastro",
      email: `auto-${randomUUID().slice(0, 8)}@example.com`,
      phone: uniquePhone,
      avatarUrl: "https://example.com/avatar.jpg",
    };

    // Ensure user exists in users table
    await db.insert(users).values({
      id: customerUser.id,
      name: customerUser.name,
      email: customerUser.email,
      phone: customerUser.phone,
      passwordHash: "hash123",
      role: "customer",
      active: true,
      emailVerified: true,
    });

    const bookingRequest = {
      slug: f.company.publicSlug!,
      locationId: f.location.id,
      date: f.date,
      startTime: "09:00",
      items: [{ serviceId: f.services[0].id, employeeId: f.team[0].id }],
      idempotencyKey: randomUUID(),
      products: [],
      intendedPaymentMethod: "pix" as const,
    };

    const booking = await createBooking(customerUser, bookingRequest);

    assert.ok(booking.id);
    assert.ok(booking.clientId);

    // Verify client record in MySQL
    const [savedClient] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.companyId, f.company.id), eq(clients.userId, customerUser.id)))
      .limit(1);

    assert.ok(savedClient, "Cliente deve ser criado automaticamente no banco");
    assert.equal(savedClient.id, booking.clientId);
    assert.equal(savedClient.name, customerUser.name);
    assert.equal(savedClient.phone, uniquePhone);
    assert.equal(savedClient.email, customerUser.email);
    assert.equal(savedClient.active, true);
    assert.equal(savedClient.deletedAt, null);

    // Verify appointment is associated with the auto-created client and the barber
    const [savedApt] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.bookingId, booking.id))
      .limit(1);

    assert.ok(savedApt);
    assert.equal(savedApt.clientId, savedClient.id);
    assert.equal(savedApt.employeeId, f.team[0].id);
  });

  it("links unlinked client record created by barber previously when customer books", async () => {
    const unlinkedClientId = randomUUID();
    const phone = "11977778888";

    // Barber manually entered client earlier
    await db.insert(clients).values({
      id: unlinkedClientId,
      companyId: f.company.id,
      userId: null,
      name: "Cliente Manual Barbearia",
      phone,
      active: true,
    });

    const customerUser = {
      ...f.customers[1],
      id: randomUUID(),
      name: "Cliente Manual Atualizado",
      email: `manual-${randomUUID().slice(0, 8)}@example.com`,
      phone,
      avatarUrl: null,
    };

    await db.insert(users).values({
      id: customerUser.id,
      name: customerUser.name,
      email: customerUser.email,
      phone: customerUser.phone,
      passwordHash: "hash123",
      role: "customer",
      active: true,
      emailVerified: true,
    });

    const bookingRequest = {
      slug: f.company.publicSlug!,
      locationId: f.location.id,
      date: f.date,
      startTime: "13:30",
      items: [{ serviceId: f.services[0].id, employeeId: f.team[0].id }],
      idempotencyKey: randomUUID(),
      products: [],
      intendedPaymentMethod: "card" as const,
    };

    const booking = await createBooking(customerUser, bookingRequest);

    assert.equal(booking.clientId, unlinkedClientId, "Deve reutilizar o registro de CRM existente sem duplicar");

    const [updatedClient] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, unlinkedClientId))
      .limit(1);

    assert.ok(updatedClient);
    assert.equal(updatedClient.userId, customerUser.id);
    assert.equal(updatedClient.name, customerUser.name);
    assert.equal(updatedClient.active, true);
    assert.equal(updatedClient.deletedAt, null);
  });

  it("reactivates soft-deleted or inactive client when booking again", async () => {
    const existingClientId = randomUUID();
    const existingUserId = randomUUID();
    const phone = "11966665555";

    const customerUser = {
      ...f.customers[0],
      id: existingUserId,
      name: "Cliente Retornando",
      email: `return-${randomUUID().slice(0, 8)}@example.com`,
      phone,
      avatarUrl: null,
    };

    await db.insert(users).values({
      id: existingUserId,
      name: customerUser.name,
      email: customerUser.email,
      phone,
      passwordHash: "hash123",
      role: "customer",
      active: true,
      emailVerified: true,
    });

    // Inactive / soft-deleted client
    await db.insert(clients).values({
      id: existingClientId,
      companyId: f.company.id,
      userId: existingUserId,
      name: "Cliente Inativo Antigo",
      phone,
      active: false,
      deletedAt: new Date("2025-01-01"),
      deletedBy: "system",
    });

    const bookingRequest = {
      slug: f.company.publicSlug!,
      locationId: f.location.id,
      date: f.date,
      startTime: "15:30",
      items: [{ serviceId: f.services[0].id, employeeId: f.team[0].id }],
      idempotencyKey: randomUUID(),
      products: [],
      intendedPaymentMethod: "cash" as const,
    };

    const booking = await createBooking(customerUser, bookingRequest);

    assert.equal(booking.clientId, existingClientId);

    const [reactivated] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, existingClientId))
      .limit(1);

    assert.ok(reactivated);
    assert.equal(reactivated.active, true);
    assert.equal(reactivated.deletedAt, null);
    assert.equal(reactivated.deletedBy, null);
    assert.equal(reactivated.name, customerUser.name);
  });
});
