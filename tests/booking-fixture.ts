import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import * as t from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { localDate, shiftDate } from "@/lib/booking/time";

export async function bookingFixture() {
  const key = randomUUID().slice(0, 8);
  const password = "TestBooking123!";
  const passwordHash = await hashPassword(password);

  const now = new Date();
  const companyId = randomUUID();
  const company: typeof t.companies.$inferSelect = {
    id: companyId,
    name: `Studio QA ${key}`,
    businessType: null,
    logoUrl: null,
    phone: null,
    whatsapp: null,
    email: null,
    address: null,
    instagram: null,
    website: null,
    publicSlug: `qa-${key}`,
    publicEnabled: true,
    cancellationHours: 2,
    timezone: "America/Sao_Paulo",
    currency: "BRL",
    primaryColor: "#dcff4c",
    secondaryColor: "#162a22",
    onboarded: true,
    allowProducts: false,
    publicDescription: null,
    publicColor: "#dcff4c",
    publicPhotos: [],
    publicPhone: false,
    publicInstagram: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(t.companies).values(company);

  const locationId = randomUUID();
  const location = {
    id: locationId,
    companyId,
    name: "Unidade Central",
    openTime: "08:00:00",
    closeTime: "20:00:00",
    active: true,
  };
  await db.insert(t.locations).values(location);

  const ownerId = randomUUID();
  const owner: typeof t.users.$inferSelect = {
    id: ownerId,
    companyId,
    name: "Profissional QA",
    email: `owner-${key}@example.test`,
    phone: null,
    avatarUrl: null,
    bannerUrl: null,
    passwordHash,
    role: "owner",
    active: true,
    isSuperadmin: false,
    emailVerified: true,
    emailVerifiedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(t.users).values(owner);

  const customerDefs: (typeof t.users.$inferSelect)[] = ["Ana", "Beatriz"].map((name) => ({
    id: randomUUID(),
    companyId: null,
    name,
    email: `${name.toLowerCase()}-${key}@example.test`,
    phone: "11987654321",
    avatarUrl: null,
    bannerUrl: null,
    passwordHash,
    role: "customer",
    active: true,
    isSuperadmin: false,
    emailVerified: true,
    emailVerifiedAt: now,
    createdAt: now,
    updatedAt: now,
  }));
  for (const c of customerDefs) {
    await db.insert(t.users).values(c);
  }
  const customers = customerDefs;

  const teamDefs = ["Ingrid QA", "Maria QA"].map((name) => ({
    id: randomUUID(),
    companyId,
    locationId,
    name,
    jobTitle: "Especialista QA",
    active: true,
  }));
  for (const e of teamDefs) {
    await db.insert(t.employees).values(e);
  }
  const team = teamDefs;

  await db.insert(t.employeeLocations).values(
    team.map((e) => ({ id: randomUUID(), employeeId: e.id, locationId, isPrimary: true })),
  );

  await db.insert(t.employeeSchedules).values(
    team.flatMap((e) =>
      Array.from({ length: 7 }, (_, day) => ({
        id: randomUUID(),
        employeeId: e.id,
        locationId,
        dayOfWeek: day,
        startTime: "09:00:00",
        endTime: "18:00:00",
        breakStart: "12:00:00",
        breakEnd: "13:00:00",
        active: true,
      })),
    ),
  );

  const serviceDefs = [
    { id: randomUUID(), companyId, name: "Manicure e Pedicure", price: "50.00", durationMinutes: 90, active: true },
    { id: randomUUID(), companyId, name: "Banho de gel", price: "90.00", durationMinutes: 60, bufferMinutes: 10, active: true },
  ];
  for (const s of serviceDefs) {
    await db.insert(t.services).values(s);
  }
  const services = serviceDefs;

  await db.insert(t.employeeServices).values(
    team.flatMap((e) => services.map((s) => ({ employeeId: e.id, serviceId: s.id }))),
  );

  let date = shiftDate(localDate(new Date(), company.timezone), 7);
  if (new Date(`${date}T12:00Z`).getUTCDay() === 0) date = shiftDate(date, 1);

  return { company, location, owner, customers, team, services, date, password, key };
}

export type Fixture = Awaited<ReturnType<typeof bookingFixture>>;

export async function cleanupFixture(f: Fixture) {
  const appts = await db
    .select({ id: t.appointments.id })
    .from(t.appointments)
    .where(eq(t.appointments.companyId, f.company.id));
  const aptIds = appts.map((a) => a.id);
  const orders = await db
    .select({ id: t.bookings.id })
    .from(t.bookings)
    .where(eq(t.bookings.companyId, f.company.id));
  const bookingIds = orders.map((b) => b.id);

  if (bookingIds.length) {
    await db.delete(t.notificationLogs).where(inArray(t.notificationLogs.bookingId, bookingIds));
    await db.delete(t.bookingProducts).where(inArray(t.bookingProducts.bookingId, bookingIds));
  }
  if (aptIds.length) {
    await db.delete(t.appointmentHistory).where(inArray(t.appointmentHistory.appointmentId, aptIds));
    await db.delete(t.payments).where(inArray(t.payments.appointmentId, aptIds));
    await db.delete(t.appointmentServices).where(inArray(t.appointmentServices.appointmentId, aptIds));
  }
  await db.delete(t.appointments).where(eq(t.appointments.companyId, f.company.id));
  await db.delete(t.bookings).where(eq(t.bookings.companyId, f.company.id));
  for (const table of [
    t.auditLogs,
    t.notifications,
    t.bookingEvents,
    t.bookingWaitlist,
    t.scheduleBlocks,
    t.products,
    t.coupons,
  ]) {
    await db.delete(table).where(eq(table.companyId, f.company.id));
  }
  const empIds = f.team.map((e) => e.id);
  for (const table of [t.employeeSchedules, t.employeeLocations, t.employeeServices]) {
    await db.delete(table).where(inArray(table.employeeId, empIds));
  }
  await db.delete(t.employees).where(eq(t.employees.companyId, f.company.id));
  await db.delete(t.services).where(eq(t.services.companyId, f.company.id));
  await db.delete(t.serviceCategories).where(eq(t.serviceCategories.companyId, f.company.id));
  await db.delete(t.clients).where(eq(t.clients.companyId, f.company.id));
  const fixtureUserIds = [f.owner.id, ...f.customers.map((c) => c.id)];
  await db.delete(t.customerAccessLogs).where(inArray(t.customerAccessLogs.userId, fixtureUserIds));
  await db.delete(t.customerCredentials).where(inArray(t.customerCredentials.userId, fixtureUserIds));
  await db.delete(t.users).where(inArray(t.users.id, fixtureUserIds));
  await db.delete(t.companySettings).where(eq(t.companySettings.companyId, f.company.id));
  await db.delete(t.locations).where(eq(t.locations.companyId, f.company.id));
  await db.delete(t.companies).where(eq(t.companies.id, f.company.id));
}
