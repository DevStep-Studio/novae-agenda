import "dotenv/config";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  clients,
  companies,
  employeeSchedules,
  employees,
  locations,
  scheduleBlocks,
  services,
} from "@/db/schema";
import { assertBookable, getAvailabilitySlots } from "@/lib/availability";

describe("Availability Engine & Conflict Validation", () => {
  let testCompanyId: string;
  let testLocationId: string;
  let joaoId: string;
  let anaId: string;
  let clientId: string;
  let serviceId: string;

  // We test on a fixed future date: Monday, October 19, 2026 (dayOfWeek = 1)
  const testDate = "2026-10-19";

  before(async () => {
    // 1. Create isolated test company & location
    const [comp] = await db
      .insert(companies)
      .values({
        name: "Test Availability Salon",
        timezone: "America/Sao_Paulo",
      })
      .returning();
    testCompanyId = comp.id;

    const [loc] = await db
      .insert(locations)
      .values({
        companyId: testCompanyId,
        name: "Unidade Central Test",
        openTime: "08:00",
        closeTime: "19:00",
      })
      .returning();
    testLocationId = loc.id;

    // 2. Create employees Joao & Ana
    const [joao] = await db
      .insert(employees)
      .values({
        companyId: testCompanyId,
        locationId: testLocationId,
        name: "João Silva",
      })
      .returning();
    joaoId = joao.id;

    const [ana] = await db
      .insert(employees)
      .values({
        companyId: testCompanyId,
        locationId: testLocationId,
        name: "Ana Pereira",
      })
      .returning();
    anaId = ana.id;

    // 3. João works Monday (dayOfWeek 1) from 09:00 to 18:00 with lunch 12:00 to 13:00
    await db.insert(employeeSchedules).values({
      employeeId: joaoId,
      locationId: testLocationId,
      dayOfWeek: 1, // Monday
      startTime: "09:00",
      endTime: "18:00",
      breakStart: "12:00",
      breakEnd: "13:00",
      active: true,
    });

    // Ana works Monday (dayOfWeek 1) from 09:00 to 18:00 with no lunch break
    await db.insert(employeeSchedules).values({
      employeeId: anaId,
      locationId: testLocationId,
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "18:00",
      active: true,
    });

    // 4. Create a client & service
    const [client] = await db
      .insert(clients)
      .values({
        companyId: testCompanyId,
        name: "Cliente Teste",
        phone: "11999990001",
      })
      .returning();
    clientId = client.id;

    const [serv] = await db
      .insert(services)
      .values({
        companyId: testCompanyId,
        name: "Corte + Barba",
        price: "75.00",
        durationMinutes: 60,
      })
      .returning();
    serviceId = serv.id;
  });

  after(async () => {
    // Cleanup isolated company and cascading rows
    await db.delete(appointments).where(eq(appointments.companyId, testCompanyId));
    await db.delete(scheduleBlocks).where(eq(scheduleBlocks.companyId, testCompanyId));
    await db.delete(employeeSchedules).where(eq(employeeSchedules.employeeId, joaoId));
    await db.delete(employeeSchedules).where(eq(employeeSchedules.employeeId, anaId));
    await db.delete(employees).where(eq(employees.companyId, testCompanyId));
    await db.delete(services).where(eq(services.companyId, testCompanyId));
    await db.delete(clients).where(eq(clients.companyId, testCompanyId));
    await db.delete(locations).where(eq(locations.companyId, testCompanyId));
    await db.delete(companies).where(eq(companies.id, testCompanyId));
  });

  it("calculates available slots respecting working hours and lunch break", async () => {
    const slots = await getAvailabilitySlots(
      {
        companyId: testCompanyId,
        employeeId: joaoId,
        date: testDate,
        durationMinutes: 60,
        timezone: "America/Sao_Paulo",
        bufferMinutes: 0,
      },
      30,
    );

    assert.ok(slots.length > 0, "Should generate availability slots");

    // João starts at 09:00, lunch is 12:00-13:00.
    // A 60-minute appointment cannot start at 11:30 (would end at 12:30, violating lunch).
    const has0900 = slots.some((s) => s.startTime === "09:00");
    const has1100 = slots.some((s) => s.startTime === "11:00");
    const has1130 = slots.some((s) => s.startTime === "11:30");
    const has1200 = slots.some((s) => s.startTime === "12:00");
    const has1300 = slots.some((s) => s.startTime === "13:00");

    assert.equal(has0900, true, "09:00 slot should be available");
    assert.equal(has1100, true, "11:00 slot should be available (ends at 12:00)");
    assert.equal(has1130, false, "11:30 slot should NOT be available (overlaps lunch)");
    assert.equal(has1200, false, "12:00 slot should NOT be available (lunch hour)");
    assert.equal(has1300, true, "13:00 slot should be available (after lunch)");
  });

  it("blocks booking outside working hours or on off-duty days", async () => {
    // Sunday (2026-10-18): João has no schedule
    const sundayCheck = await assertBookable({
      companyId: testCompanyId,
      employeeId: joaoId,
      date: "2026-10-18",
      durationMinutes: 60,
      timezone: "America/Sao_Paulo",
      startMinutes: 600, // 10:00
      endMinutes: 660, // 11:00
    });
    assert.equal(sundayCheck.ok, false);
    if (!sundayCheck.ok) {
      assert.equal(sundayCheck.status, 422);
      assert.equal(sundayCheck.error, "O profissional não atende nesse dia.");
    }

    // Monday 08:00 - 09:00 (before João's shift at 09:00)
    const earlyCheck = await assertBookable({
      companyId: testCompanyId,
      employeeId: joaoId,
      date: testDate,
      durationMinutes: 60,
      timezone: "America/Sao_Paulo",
      startMinutes: 480, // 08:00
      endMinutes: 540, // 09:00
    });
    assert.equal(earlyCheck.ok, false);
    if (!earlyCheck.ok) {
      assert.equal(earlyCheck.status, 422);
      assert.equal(earlyCheck.error, "Esse horário está fora da jornada do profissional.");
    }
  });

  it("detects conflict and returns 409 when overlapping existing appointment", async () => {
    // Create existing appointment for João: 14:00 - 15:00
    const [apt] = await db
      .insert(appointments)
      .values({
        companyId: testCompanyId,
        locationId: testLocationId,
        clientId,
        employeeId: joaoId,
        appointmentDate: testDate,
        startTime: "14:00",
        endTime: "15:00",
        status: "confirmed",
        total: "75.00",
      })
      .returning();

    // Attempt to book João at 14:30 - 15:30 -> Conflict!
    const conflictCheck = await assertBookable({
      companyId: testCompanyId,
      employeeId: joaoId,
      date: testDate,
      durationMinutes: 60,
      timezone: "America/Sao_Paulo",
      startMinutes: 14 * 60 + 30, // 14:30
      endMinutes: 15 * 60 + 30, // 15:30
      bufferMinutes: 0,
    });

    assert.equal(conflictCheck.ok, false, "Booking at 14:30 for João should be blocked");
    if (!conflictCheck.ok) {
      assert.equal(conflictCheck.status, 409);
      assert.equal(conflictCheck.error, "Este profissional já possui um atendimento nesse horário.");
    }

    // Attempt to book Ana at the same time (14:30 - 15:30) -> Allowed!
    const anaCheck = await assertBookable({
      companyId: testCompanyId,
      employeeId: anaId,
      date: testDate,
      durationMinutes: 60,
      timezone: "America/Sao_Paulo",
      startMinutes: 14 * 60 + 30,
      endMinutes: 15 * 60 + 30,
      bufferMinutes: 0,
    });

    assert.equal(anaCheck.ok, true, "Booking at 14:30 for Ana should be permitted");

    // Clean up appointment
    await db.delete(appointments).where(eq(appointments.id, apt.id));
  });

  it("enforces appointment buffer interval (e.g. 10 minutes)", async () => {
    // Appointment 1: 14:00 - 15:00
    const [apt] = await db
      .insert(appointments)
      .values({
        companyId: testCompanyId,
        locationId: testLocationId,
        clientId,
        employeeId: joaoId,
        appointmentDate: testDate,
        startTime: "14:00",
        endTime: "15:00",
        status: "confirmed",
        total: "75.00",
      })
      .returning();

    // With 10 min buffer, 15:00 to 16:00 should collide because buffer extends appointment to 15:10
    const immediateCheck = await assertBookable({
      companyId: testCompanyId,
      employeeId: joaoId,
      date: testDate,
      durationMinutes: 60,
      timezone: "America/Sao_Paulo",
      startMinutes: 15 * 60, // 15:00
      endMinutes: 16 * 60, // 16:00
      bufferMinutes: 10,
    });

    assert.equal(immediateCheck.ok, false, "15:00 should be rejected due to 10-minute buffer");
    if (!immediateCheck.ok) {
      assert.equal(immediateCheck.status, 409);
    }

    // At 15:10 - 16:10, buffer is respected -> Allowed!
    const bufferedCheck = await assertBookable({
      companyId: testCompanyId,
      employeeId: joaoId,
      date: testDate,
      durationMinutes: 60,
      timezone: "America/Sao_Paulo",
      startMinutes: 15 * 60 + 10, // 15:10
      endMinutes: 16 * 60 + 10, // 16:10
      bufferMinutes: 10,
    });

    assert.equal(bufferedCheck.ok, true, "15:10 should be allowed with 10-minute buffer");

    await db.delete(appointments).where(eq(appointments.id, apt.id));
  });

  it("blocks booking during scheduled blocks (holiday and vacation period)", async () => {
    // 1. Partial block for João: 16:00 to 17:00 (Meeting)
    const [meetingBlock] = await db
      .insert(scheduleBlocks)
      .values({
        companyId: testCompanyId,
        employeeId: joaoId,
        reason: "Reunião de Equipe",
        startsAt: new Date(`${testDate}T16:00:00Z`),
        endsAt: new Date(`${testDate}T17:00:00Z`),
        allDay: false,
      })
      .returning();

    const meetingCheck = await assertBookable({
      companyId: testCompanyId,
      employeeId: joaoId,
      date: testDate,
      durationMinutes: 60,
      timezone: "America/Sao_Paulo",
      startMinutes: 16 * 60,
      endMinutes: 17 * 60,
    });

    assert.equal(meetingCheck.ok, false);
    if (!meetingCheck.ok) {
      assert.equal(meetingCheck.status, 422);
      assert.equal(meetingCheck.error, "Há um bloqueio na agenda do profissional nesse horário.");
    }

    // 2. Company-wide holiday (employeeId null, allDay true)
    const [holidayBlock] = await db
      .insert(scheduleBlocks)
      .values({
        companyId: testCompanyId,
        employeeId: null,
        reason: "Feriado Municipal",
        startsAt: new Date(`${testDate}T00:00:00Z`),
        endsAt: new Date(`${testDate}T23:59:59Z`),
        allDay: true,
      })
      .returning();

    // Now even Ana (who has no appointment) is blocked for the whole day
    const holidaySlots = await getAvailabilitySlots({
      companyId: testCompanyId,
      employeeId: anaId,
      date: testDate,
      durationMinutes: 60,
      timezone: "America/Sao_Paulo",
    });

    assert.equal(holidaySlots.length, 0, "No slots should be available on a company-wide holiday");

    await db.delete(scheduleBlocks).where(eq(scheduleBlocks.id, meetingBlock.id));
    await db.delete(scheduleBlocks).where(eq(scheduleBlocks.id, holidayBlock.id));
  });
});
