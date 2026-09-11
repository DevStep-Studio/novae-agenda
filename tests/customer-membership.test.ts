import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  bookingMembershipUsage,
  clients,
  companies,
  customerMembershipPayments,
  customerMemberships,
  employees,
  employeeSchedules,
  employeeServices,
  locations,
  membershipPeriods,
  membershipPlans,
  services,
  subscriptions,
} from "@/db/schema";
import {
  calculatePeriodAllowance,
  getWeekdayDatesInMonth,
} from "@/lib/membership/calendar-engine";
import {
  assignCustomerMembership,
  bookBatchAppointments,
  cancelMembershipAppointment,
  createMembershipPlan,
  getCustomerActiveMembership,
  getCustomerMembershipDetails,
  getMonthScheduleSlots,
  getOrCreateCurrentPeriod,
  recordMembershipPeriodPayment,
  rescheduleMembershipAppointment,
} from "@/lib/membership/membership-service";

async function createTestTenant(name: string) {
  const companyId = crypto.randomUUID();
  await db.insert(companies).values({
    id: companyId,
    name,
    businessType: "Multiservice",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
    primaryColor: "#dcff4c",
    secondaryColor: "#162a22",
    publicSlug: `test-${companyId.slice(0, 8)}`,
    publicEnabled: true,
  });

  const locationId = crypto.randomUUID();
  await db.insert(locations).values({
    id: locationId,
    companyId,
    name: "Unidade Principal",
    openTime: "08:00",
    closeTime: "20:00",
    active: true,
  });

  await db.insert(subscriptions).values({
    id: crypto.randomUUID(),
    companyId,
    plan: "pro_monthly",
    status: "active",
    trialEndsAt: new Date(Date.now() + 864000000),
  });

  const employeeId = crypto.randomUUID();
  await db.insert(employees).values({
    id: employeeId,
    companyId,
    locationId,
    name: "Profissional Principal",
    phone: "11999990000",
    jobTitle: "Especialista",
    commissionType: "percentage",
    commissionValue: "30.00",
    active: true,
  });

  // Working schedule: Mon to Fri 08:00 to 18:00
  for (let day = 1; day <= 5; day++) {
    await db.insert(employeeSchedules).values({
      id: crypto.randomUUID(),
      employeeId,
      locationId,
      dayOfWeek: day,
      startTime: "08:00",
      endTime: "18:00",
      active: true,
    });
  }

  const serviceId = crypto.randomUUID();
  await db.insert(services).values({
    id: serviceId,
    companyId,
    name: "Atendimento Padrão",
    description: "Sessão individual",
    price: "80.00",
    durationMinutes: 60,
    active: true,
  });

  await db.insert(employeeServices).values({
    employeeId,
    serviceId,
    commissionType: "percentage",
    commissionValue: "30.00",
  });

  const clientId = crypto.randomUUID();
  await db.insert(clients).values({
    id: clientId,
    companyId,
    name: "Cliente Teste",
    phone: "11988887777",
    email: `cliente-${clientId.slice(0, 8)}@test.com`,
    active: true,
  });

  return { companyId, employeeId, serviceId, clientId };
}

test("Customer Membership & Recurring Plans Suite", async (t) => {
  const tenantA = await createTestTenant("Empresa A");
  const tenantB = await createTestTenant("Empresa B");

  await t.test("1. Calendar Engine: Weekly 4 occurrences vs 5 occurrences", () => {
    // September 2026 Thursdays (dayOfWeek = 4): 3, 10, 17, 24 -> 4 occurrences
    const septThursdays = getWeekdayDatesInMonth(2026, 9, [4]);
    assert.deepEqual(septThursdays, [
      "2026-09-03",
      "2026-09-10",
      "2026-09-17",
      "2026-09-24",
    ]);
    const septAllowance = calculatePeriodAllowance(
      "WEEKLY_CALENDAR_BASED",
      2026,
      9,
      [4],
    );
    assert.equal(septAllowance.allowance, 4);

    // October 2026 Thursdays (dayOfWeek = 4): 1, 8, 15, 22, 29 -> 5 occurrences!
    const octThursdays = getWeekdayDatesInMonth(2026, 10, [4]);
    assert.deepEqual(octThursdays, [
      "2026-10-01",
      "2026-10-08",
      "2026-10-15",
      "2026-10-22",
      "2026-10-29",
    ]);
    const octAllowance = calculatePeriodAllowance(
      "WEEKLY_CALENDAR_BASED",
      2026,
      10,
      [4],
    );
    assert.equal(octAllowance.allowance, 5);
  });

  await t.test("2. Calendar Engine: Fixed monthly quota (4 sessions/month) regardless of 5 weeks", () => {
    // Even in October 2026 which has 5 weeks, FIXED_MONTHLY_QUOTA returns exactly 4
    const fixedAllowance = calculatePeriodAllowance(
      "FIXED_MONTHLY_QUOTA",
      2026,
      10,
      [4],
      4,
    );
    assert.equal(fixedAllowance.allowance, 4);
  });

  await t.test("3. Calendar Engine: 2x per week (Tuesday + Thursday)", () => {
    // September 2026: Tuesdays (1, 8, 15, 22, 29 = 5) + Thursdays (3, 10, 17, 24 = 4) = 9 total
    const tueThu = getWeekdayDatesInMonth(2026, 9, [2, 4]);
    assert.equal(tueThu.length, 9);
    assert.ok(tueThu.includes("2026-09-01"));
    assert.ok(tueThu.includes("2026-09-03"));
    assert.ok(tueThu.includes("2026-09-29"));

    const multiAllowance = calculatePeriodAllowance(
      "CUSTOM_WEEKLY_FREQUENCY",
      2026,
      9,
      [2, 4],
      undefined,
      2,
    );
    assert.equal(multiAllowance.allowance, 9);
  });

  await t.test("4. Plan Creation & Assignment with Entitlement", async () => {
    try {
      const plan = await createMembershipPlan(tenantA.companyId, {
        name: "Plano Semanal Premium",
        description: "1 atendimento por semana",
        price: 240,
        frequencyType: "WEEKLY_CALENDAR_BASED",
        serviceIds: [tenantA.serviceId],
        employeeIds: [tenantA.employeeId],
        allowReschedule: true,
        rescheduleHoursNotice: 2,
      });

      assert.ok(plan);
      assert.equal(plan.name, "Plano Semanal Premium");
      assert.equal(plan.price, 240);
      assert.equal(plan.serviceIds.length, 1);

      const membership = await assignCustomerMembership(tenantA.companyId, {
        clientId: tenantA.clientId,
        membershipPlanId: plan.id,
        preferredProfessionalId: tenantA.employeeId,
        preferredWeekdays: [4], // Thursday
        preferredTime: "14:00",
        startsAt: new Date("2026-10-01T12:00:00"),
      });

      assert.ok(membership);
      assert.equal(membership.status, "active");
      assert.equal(membership.clientId, tenantA.clientId);
      assert.equal(membership.monthlyPriceSnapshot, 240);
      assert.equal(membership.currentPeriod?.sessionAllowance, 5); // October has 5 Thursdays!
      assert.equal(membership.currentPeriod?.sessionsBooked, 0);
      assert.equal(membership.currentPeriod?.sessionsRemaining, 5);
      assert.equal(membership.currentPeriod?.paymentStatus, "pending");
    } catch (err) {
      console.error("DEBUG STEP 4 ERROR:", err);
      throw err;
    }
  });

  await t.test("5. Batch Scheduling: Multiple Dates in One Transaction", async () => {
    try {
      const active = await getCustomerActiveMembership(tenantA.companyId, tenantA.clientId);
      assert.ok(active);

      const octDates = ["2026-10-01", "2026-10-08", "2026-10-15", "2026-10-22", "2026-10-29"];

      const result = await bookBatchAppointments(tenantA.companyId, {
        customerMembershipId: active.id,
        slots: octDates.map((date) => ({
          date,
          startTime: "14:00",
          serviceId: tenantA.serviceId,
          employeeId: tenantA.employeeId,
        })),
      });

      assert.equal(result.success, true);
      assert.equal(result.bookedCount, 5);
      assert.equal(result.conflicts.length, 0);
      assert.equal(result.createdAppointments.length, 5);

      // Check that appointment total is 0 and flagged as membership
      for (const apt of result.createdAppointments) {
        assert.equal(apt.total, 0);
        assert.equal(apt.isMembershipBooking, true);
        assert.ok(apt.notes?.includes("Incluído no plano"));
      }

      // Verify period counts
      const updated = await getCustomerMembershipDetails(tenantA.companyId, active.id);
      assert.equal(updated?.currentPeriod?.sessionsBooked, 5);
      assert.equal(updated?.currentPeriod?.sessionsRemaining, 0);
    } catch (err) {
      console.error("DEBUG STEP 5 ERROR:", err);
      throw err;
    }
  });

  await t.test("6. Partial Conflict Handling during Batch Booking", async () => {
    try {
      // Create another client and assign a membership
      const client2Id = crypto.randomUUID();
      await db.insert(clients).values({
        id: client2Id,
        companyId: tenantA.companyId,
        name: "Segundo Cliente",
        phone: "11977776666",
        active: true,
      });

      const plan = (await createMembershipPlan(tenantA.companyId, {
        name: "Plano Fixo 4",
        price: 180,
        frequencyType: "FIXED_MONTHLY_QUOTA",
        sessionsPerPeriod: 4,
        serviceIds: [tenantA.serviceId],
      }))!;

      const membership2 = (await assignCustomerMembership(tenantA.companyId, {
        clientId: client2Id,
        membershipPlanId: plan.id,
        startsAt: new Date("2026-10-01T12:00:00"),
      }))!;

      // Try booking 14:00 (which is ALREADY OCCUPIED by client 1 on 2026-10-01) and 16:00 on 2026-10-08 (which is FREE)
      const result = await bookBatchAppointments(tenantA.companyId, {
        customerMembershipId: membership2.id,
        slots: [
          { date: "2026-10-01", startTime: "14:00" }, // CONFLICT
          { date: "2026-10-08", startTime: "16:00" }, // SUCCESS
        ],
      });

      assert.equal(result.bookedCount, 1);
      assert.equal(result.conflicts.length, 1);
      assert.equal(result.conflicts[0].date, "2026-10-01");
      assert.equal(result.conflicts[0].requestedStartTime, "14:00");
    } catch (err) {
      console.error("DEBUG STEP 6 ERROR:", err);
      throw err;
    }
  });

  await t.test("7. Reschedule & Cancel with Session Refund Rules", async () => {
    try {
      const active = await getCustomerActiveMembership(tenantA.companyId, tenantA.clientId);
      assert.ok(active && active.currentPeriod?.bookings);

      const firstBooking = active.currentPeriod.bookings[0];
      assert.ok(firstBooking);

      // Reschedule appointment from 14:00 to 10:00 on the same date
      const res = await rescheduleMembershipAppointment(
        tenantA.companyId,
        firstBooking.appointmentId,
        firstBooking.date,
        "10:00",
      );
      assert.equal(res.success, true);

      const [updatedApt] = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, firstBooking.appointmentId));
      assert.equal(updatedApt?.startTime, "10:00:00");

      // Cancel appointment: verifies credit is restored to period
      const cancelRes = await cancelMembershipAppointment(
        tenantA.companyId,
        firstBooking.appointmentId,
        "Mudança de planos",
      );
      assert.equal(cancelRes.success, true);
      assert.equal(cancelRes.sessionRefunded, true);

      const refreshed = await getCustomerMembershipDetails(tenantA.companyId, active.id);
      assert.equal(refreshed?.currentPeriod?.sessionsBooked, 4);
      assert.equal(refreshed?.currentPeriod?.sessionsRemaining, 1);
    } catch (err) {
      console.error("DEBUG STEP 7 ERROR:", err);
      throw err;
    }
  });

  await t.test("8. Financial: Record Single Membership Payment Presentially", async () => {
    const active = await getCustomerActiveMembership(tenantA.companyId, tenantA.clientId);
    assert.ok(active && active.currentPeriod);

    const payRes = await recordMembershipPeriodPayment(
      tenantA.companyId,
      active.id,
      active.currentPeriod.id,
      {
        method: "pix",
        amount: 240,
        notes: "Comprovante PIX #123456",
      },
    );

    assert.equal(payRes.success, true);

    const refreshed = await getCustomerMembershipDetails(tenantA.companyId, active.id);
    assert.equal(refreshed?.currentPeriod?.paymentStatus, "paid");
    assert.equal(refreshed?.currentPeriod?.paymentMethod, "pix");

    // Check financial transaction record
    const [payRecord] = await db
      .select()
      .from(customerMembershipPayments)
      .where(eq(customerMembershipPayments.membershipPeriodId, active.currentPeriod.id));

    assert.ok(payRecord);
    assert.equal(payRecord.amount, "240.00");
    assert.equal(payRecord.method, "pix");
  });

  await t.test("9. Multitenant Security Isolation", async () => {
    // Tenant B cannot fetch Tenant A's membership plans or customer memberships
    const activeA = await getCustomerActiveMembership(tenantA.companyId, tenantA.clientId);
    assert.ok(activeA);

    const resultB = await getCustomerMembershipDetails(tenantB.companyId, activeA.id);
    assert.equal(resultB, null);
  });
});
