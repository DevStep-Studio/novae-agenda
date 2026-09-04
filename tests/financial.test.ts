import "dotenv/config";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appointmentServices,
  appointments,
  clients,
  companies,
  employees,
  locations,
  payments,
  services,
} from "@/db/schema";

describe("Financial Operations, Commissions & Revenue Distinction", () => {
  let testCompanyId: string;
  let testLocationId: string;
  let employeeId: string;
  let clientId: string;
  let serviceId: string;

  before(async () => {
    const [comp] = await db
      .insert(companies)
      .values({
        name: "Test Financial Salon",
        timezone: "America/Sao_Paulo",
      })
      .returning();
    testCompanyId = comp.id;

    const [loc] = await db
      .insert(locations)
      .values({
        companyId: testCompanyId,
        name: "Unidade Financeiro",
      })
      .returning();
    testLocationId = loc.id;

    // Professional with 40% commission
    const [emp] = await db
      .insert(employees)
      .values({
        companyId: testCompanyId,
        locationId: testLocationId,
        name: "Carlos Barbeiro",
        commissionType: "percentage",
        commissionValue: "40.00",
      })
      .returning();
    employeeId = emp.id;

    const [cli] = await db
      .insert(clients)
      .values({
        companyId: testCompanyId,
        name: "Cliente Financeiro",
        phone: "11988887777",
      })
      .returning();
    clientId = cli.id;

    const [serv] = await db
      .insert(services)
      .values({
        companyId: testCompanyId,
        name: "Corte Especial",
        price: "100.00",
        durationMinutes: 45,
      })
      .returning();
    serviceId = serv.id;
  });

  after(async () => {
    await db.delete(payments).where(eq(payments.companyId, testCompanyId));
    await db.delete(appointmentServices).where(
      sql`${appointmentServices.appointmentId} IN (SELECT id FROM ${appointments} WHERE company_id = ${testCompanyId})`,
    );
    await db.delete(appointments).where(eq(appointments.companyId, testCompanyId));
    await db.delete(services).where(eq(services.companyId, testCompanyId));
    await db.delete(employees).where(eq(employees.companyId, testCompanyId));
    await db.delete(clients).where(eq(clients.companyId, testCompanyId));
    await db.delete(locations).where(eq(locations.companyId, testCompanyId));
    await db.delete(companies).where(eq(companies.id, testCompanyId));
  });

  it("distinguishes projected revenue from realized revenue", async () => {
    // 1. Create a scheduled appointment for R$ 100.00
    const [aptScheduled] = await db
      .insert(appointments)
      .values({
        companyId: testCompanyId,
        locationId: testLocationId,
        clientId,
        employeeId,
        appointmentDate: "2026-10-20",
        startTime: "10:00",
        endTime: "10:45",
        status: "scheduled",
        total: "100.00",
      })
      .returning();

    // 2. Create a completed appointment with payment for R$ 80.00
    const [aptCompleted] = await db
      .insert(appointments)
      .values({
        companyId: testCompanyId,
        locationId: testLocationId,
        clientId,
        employeeId,
        appointmentDate: "2026-10-20",
        startTime: "11:00",
        endTime: "11:45",
        status: "completed",
        total: "80.00",
      })
      .returning();

    await db.insert(payments).values({
      companyId: testCompanyId,
      appointmentId: aptCompleted.id,
      amount: "80.00",
      discount: "0.00",
      method: "PIX",
      status: "paid",
      paidAt: new Date(),
    });

    // Query Projected revenue (sum of active appointments total)
    const [projected] = await db
      .select({
        totalProjected: sql<string>`coalesce(sum(${appointments.total}::numeric), 0)`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, testCompanyId),
          sql`${appointments.status} NOT IN ('cancelled', 'no_show')`,
        ),
      );

    // Query Realized revenue (sum of payments with status = 'paid')
    const [realized] = await db
      .select({
        totalRealized: sql<string>`coalesce(sum(${payments.amount}::numeric), 0)`,
      })
      .from(payments)
      .where(and(eq(payments.companyId, testCompanyId), eq(payments.status, "paid")));

    // Expected:
    // Projected = 100.00 + 80.00 = 180.00
    // Realized = 80.00 ONLY
    assert.equal(Number(projected.totalProjected), 180.0);
    assert.equal(Number(realized.totalRealized), 80.0);
    assert.notEqual(Number(projected.totalProjected), Number(realized.totalRealized));

    // Cleanup the appointments
    await db.delete(payments).where(eq(payments.appointmentId, aptCompleted.id));
    await db.delete(appointments).where(eq(appointments.id, aptScheduled.id));
    await db.delete(appointments).where(eq(appointments.id, aptCompleted.id));
  });

  it("registers payment with discount and calculates professional commission", async () => {
    // Service price = R$ 100.00. Discount = R$ 15.00. Final paid = R$ 85.00.
    // Professional has 40% commission on service price (or paid price):
    // 40% of R$ 85.00 = R$ 34.00 (or 40% of R$ 100 = R$ 40)
    const [apt] = await db
      .insert(appointments)
      .values({
        companyId: testCompanyId,
        locationId: testLocationId,
        clientId,
        employeeId,
        appointmentDate: "2026-10-21",
        startTime: "14:00",
        endTime: "14:45",
        status: "in_progress",
        total: "100.00",
      })
      .returning();

    // Transaction mimicking /api/appointments/[id]/finish
    const discountNum = 15.0;
    const finalAmountNum = 85.0;
    const commissionPercent = 40.0;
    const commissionAmount = (finalAmountNum * (commissionPercent / 100)).toFixed(2); // 34.00

    await db.transaction(async (tx) => {
      // 1. Mark appointment completed
      await tx
        .update(appointments)
        .set({ status: "completed" })
        .where(eq(appointments.id, apt.id));

      // 2. Snapshot service & commission in appointment_services
      await tx.insert(appointmentServices).values({
        appointmentId: apt.id,
        serviceId,
        price: "100.00",
        durationMinutes: 45,
        commissionType: "percentage",
        commissionValue: "40.00",
        commissionAmount,
      });

      // 3. Register payment
      await tx.insert(payments).values({
        companyId: testCompanyId,
        appointmentId: apt.id,
        amount: finalAmountNum.toFixed(2),
        discount: discountNum.toFixed(2),
        method: "PIX",
        status: "paid",
        paidAt: new Date(),
      });
    });

    // Verify Payment
    const [paymentRecord] = await db
      .select()
      .from(payments)
      .where(eq(payments.appointmentId, apt.id));

    assert.ok(paymentRecord, "Payment record must exist");
    assert.equal(paymentRecord.amount, "85.00");
    assert.equal(paymentRecord.discount, "15.00");
    assert.equal(paymentRecord.method, "PIX");
    assert.equal(paymentRecord.status, "paid");

    // Verify Commission snapshot
    const [serviceRecord] = await db
      .select()
      .from(appointmentServices)
      .where(eq(appointmentServices.appointmentId, apt.id));

    assert.ok(serviceRecord, "Appointment service snapshot must exist");
    assert.equal(serviceRecord.commissionAmount, "34.00");

    // Clean up
    await db.delete(payments).where(eq(payments.appointmentId, apt.id));
    await db.delete(appointmentServices).where(eq(appointmentServices.appointmentId, apt.id));
    await db.delete(appointments).where(eq(appointments.id, apt.id));
  });

  it("preserves historical prices even when the catalog service price changes", async () => {
    // 1. Complete appointment with service price R$ 100.00
    const [apt] = await db
      .insert(appointments)
      .values({
        companyId: testCompanyId,
        locationId: testLocationId,
        clientId,
        employeeId,
        appointmentDate: "2026-10-22",
        startTime: "15:00",
        endTime: "15:45",
        status: "completed",
        total: "100.00",
      })
      .returning();

    await db.insert(appointmentServices).values({
      appointmentId: apt.id,
      serviceId,
      price: "100.00",
      durationMinutes: 45,
      commissionType: "percentage",
      commissionValue: "40.00",
      commissionAmount: "40.00",
    });

    await db.insert(payments).values({
      companyId: testCompanyId,
      appointmentId: apt.id,
      amount: "100.00",
      discount: "0.00",
      method: "credito",
      status: "paid",
      paidAt: new Date(),
    });

    // 2. Later, manager updates the catalog service price from R$ 100.00 to R$ 150.00
    await db
      .update(services)
      .set({ price: "150.00" })
      .where(eq(services.id, serviceId));

    // 3. Verify the historical appointment still reflects R$ 100.00, NOT R$ 150.00
    const [historicalApt] = await db
      .select({
        aptTotal: appointments.total,
        servicePrice: appointmentServices.price,
      })
      .from(appointments)
      .innerJoin(appointmentServices, eq(appointments.id, appointmentServices.appointmentId))
      .where(eq(appointments.id, apt.id));

    assert.equal(historicalApt.aptTotal, "100.00", "Appointment total snapshot must not change");
    assert.equal(historicalApt.servicePrice, "100.00", "Historical service price must not change");

    // Verify catalog reflects new price
    const [catalogService] = await db.select().from(services).where(eq(services.id, serviceId));
    assert.equal(catalogService.price, "150.00", "Catalog price was updated");

    // Clean up
    await db.delete(payments).where(eq(payments.appointmentId, apt.id));
    await db.delete(appointmentServices).where(eq(appointmentServices.appointmentId, apt.id));
    await db.delete(appointments).where(eq(appointments.id, apt.id));
  });
});
