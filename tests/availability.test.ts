import "dotenv/config";
import { localInstant, localDate, shiftDate } from "@/lib/booking/time";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
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

  // Keep tests within the real booking horizon as calendar time advances.
  const baseDate = shiftDate(localDate(new Date(), "America/Sao_Paulo"), 7);
  const testDate = shiftDate(baseDate, (8 - new Date(`${baseDate}T12:00:00Z`).getUTCDay()) % 7);

  before(async () => {
    // 1. Create isolated test company & location
    testCompanyId = crypto.randomUUID();
    await db
      .insert(companies)
      .values({
        id: testCompanyId,
        name: "Test Availability Salon",
        timezone: "America/Sao_Paulo",
      });

    testLocationId = crypto.randomUUID();
    await db
      .insert(locations)
      .values({
        id: testLocationId,
        companyId: testCompanyId,
        name: "Unidade Central Test",
        openTime: "08:00",
        closeTime: "19:00",
      });

    // 2. Create employees Joao & Ana
    joaoId = crypto.randomUUID();
    await db
      .insert(employees)
      .values({
        id: joaoId,
        companyId: testCompanyId,
        locationId: testLocationId,
        name: "João Silva",
      });

    anaId = crypto.randomUUID();
    await db
      .insert(employees)
      .values({
        id: anaId,
        companyId: testCompanyId,
        locationId: testLocationId,
        name: "Ana Pereira",
      });

    // 3. João works Monday (dayOfWeek 1) from 09:00 to 18:00 with lunch 12:00 to 13:00
    await db.insert(employeeSchedules).values({
      id: crypto.randomUUID(),
      employeeId: joaoId,
      locationId: testLocationId,
      dayOfWeek: 1, // Monday
      startTime: "09:00",
      endTime: "18:00",
      breakStart: "12:00",
      breakEnd: "13:00",
      active: true,
    });

    // Ana works Monday (dayOfWeek 1) from 13:00 to 19:00 with no lunch break
    await db.insert(employeeSchedules).values({
      id: crypto.randomUUID(),
      employeeId: anaId,
      locationId: testLocationId,
      dayOfWeek: 1, // Monday
      startTime: "13:00",
      endTime: "19:00",
      breakStart: null,
      breakEnd: null,
      active: true,
    });

    // 4. Create a client & service
    clientId = crypto.randomUUID();
    await db
      .insert(clients)
      .values({
        id: clientId,
        companyId: testCompanyId,
        name: "Cliente Teste",
        phone: "11999990001",
      });

    serviceId = crypto.randomUUID();
    await db
      .insert(services)
      .values({
        id: serviceId,
        companyId: testCompanyId,
        name: "Corte + Barba",
        price: "75.00",
        durationMinutes: 60,
      });
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
    await pool.end();
  });

  it("calculates slots correctly respecting working hours and lunch break", async () => {
    // João works 09:00 to 18:00, lunch 12:00 to 13:00. Service is 60 min.
    // Expected slots for João: 09:00, 10:00, 11:00, (12:00 skipped), 13:00, 14:00, 15:00, 16:00, 17:00
    const slots = await getAvailabilitySlots({
      companyId: testCompanyId,
      employeeId: joaoId,
      date: testDate,
      durationMinutes: 60,
      timezone: "America/Sao_Paulo",
    });

    const startTimes = slots.map((s) => s.startTime);
    assert.ok(startTimes.length > 0, "Slots should be generated");
    assert.ok(startTimes.includes("09:00"), "09:00 should be available");
    assert.ok(startTimes.includes("11:00"), "11:00 should be available (ends at 12:00)");
    assert.equal(startTimes.includes("12:00"), false, "12:00 should NOT be available due to lunch break");
    assert.equal(startTimes.includes("12:30"), false, "12:30 should NOT be available due to lunch break");
    assert.ok(startTimes.includes("13:00"), "13:00 should be available");
    assert.ok(startTimes.includes("17:00"), "17:00 should be available (ends at 18:00)");
    assert.equal(startTimes.includes("18:00"), false, "18:00 should NOT be available (past closing)");
  });

  it("handles multi-professional aggregation for the same time slot", async () => {
    // When no specific employee is requested, returns combined unique available slots
    const combinedSlots = await getAvailabilitySlots({
      companyId: testCompanyId,
      employeeId: "" as any, // any employee
      date: testDate,
      durationMinutes: 60,
      timezone: "America/Sao_Paulo",
    });

    const combinedTimes = combinedSlots.map((s) => s.startTime);
    // João has 09:00, Ana only starts at 13:00
    assert.ok(combinedTimes.includes("09:00"), "09:00 is available (via João)");
    // Both have 14:00
    assert.ok(combinedTimes.includes("14:00"), "14:00 is available (via both)");
    // Ana works until 19:00, so 18:00 is available via Ana (João stops at 18:00)
    assert.ok(combinedTimes.includes("18:00"), "18:00 is available (via Ana)");
  });

  it("detects conflict with an existing appointment for the same employee", async () => {
    // Book João at 14:00 - 15:00
    const aptId = crypto.randomUUID();
    await db
      .insert(appointments)
      .values({
        id: aptId,
        companyId: testCompanyId,
        locationId: testLocationId,
        clientId,
        employeeId: joaoId,
        appointmentDate: testDate,
        startTime: "14:00",
        endTime: "15:00",
        status: "confirmed",
        total: "75.00",
      });

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
    await db.delete(appointments).where(eq(appointments.id, aptId));
  });

  it("enforces appointment buffer interval (e.g. 10 minutes)", async () => {
    // Appointment 1: 14:00 - 15:00
    const aptId = crypto.randomUUID();
    await db
      .insert(appointments)
      .values({
        id: aptId,
        companyId: testCompanyId,
        locationId: testLocationId,
        clientId,
        employeeId: joaoId,
        appointmentDate: testDate,
        startTime: "14:00",
        endTime: "15:00",
        status: "confirmed",
        total: "75.00",
      });

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

    await db.delete(appointments).where(eq(appointments.id, aptId));
  });

  it("blocks booking during scheduled blocks (holiday and vacation period)", async () => {
    // 1. Partial block for João: 16:00 to 17:00 (Meeting)
    const meetingBlockId = crypto.randomUUID();
    await db
      .insert(scheduleBlocks)
      .values({
        id: meetingBlockId,
        companyId: testCompanyId,
        employeeId: joaoId,
        reason: "Reunião de Equipe",
        startsAt: localInstant(testDate,"16:00","America/Sao_Paulo"),
        endsAt: localInstant(testDate,"17:00","America/Sao_Paulo"),
        allDay: false,
      });

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
    const holidayBlockId = crypto.randomUUID();
    await db
      .insert(scheduleBlocks)
      .values({
        id: holidayBlockId,
        companyId: testCompanyId,
        employeeId: null,
        reason: "Feriado Municipal",
        startsAt: localInstant(testDate,"00:00","America/Sao_Paulo"),
        endsAt: localInstant(testDate,"23:59","America/Sao_Paulo"),
        allDay: true,
      });

    // Now even Ana (who has no appointment) is blocked for the whole day
    const holidaySlots = await getAvailabilitySlots({
      companyId: testCompanyId,
      employeeId: anaId,
      date: testDate,
      durationMinutes: 60,
      timezone: "America/Sao_Paulo",
    });

    assert.equal(holidaySlots.length, 0, "No slots should be available on a company-wide holiday");

    await db.delete(scheduleBlocks).where(eq(scheduleBlocks.id, meetingBlockId));
    await db.delete(scheduleBlocks).where(eq(scheduleBlocks.id, holidayBlockId));
  });
});
