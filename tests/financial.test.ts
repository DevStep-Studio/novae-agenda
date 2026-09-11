import "dotenv/config";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
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

describe("Financial Integrity & Commission Precision", () => {
  let testCompanyId: string;
  let testLocationId: string;
  let employeeId: string;
  let clientId: string;
  let serviceId: string;

  before(async () => {
    testCompanyId = crypto.randomUUID();
    await db
      .insert(companies)
      .values({
        id: testCompanyId,
        name: "Test Financial Salon",
        timezone: "America/Sao_Paulo",
      });

    testLocationId = crypto.randomUUID();
    await db
      .insert(locations)
      .values({
        id: testLocationId,
        companyId: testCompanyId,
        name: "Unidade Financeiro",
      });

    // Professional with 40% commission
    employeeId = crypto.randomUUID();
    await db
      .insert(employees)
      .values({
        id: employeeId,
        companyId: testCompanyId,
        locationId: testLocationId,
        name: "Carlos Barbeiro",
        commissionType: "percentage",
        commissionValue: "40.00",
      });

    clientId = crypto.randomUUID();
    await db
      .insert(clients)
      .values({
        id: clientId,
        companyId: testCompanyId,
        name: "Cliente Financeiro",
        phone: "11988887777",
      });

    serviceId = crypto.randomUUID();
    await db
      .insert(services)
      .values({
        id: serviceId,
        companyId: testCompanyId,
        name: "Corte Especial",
        price: "100.00",
        durationMinutes: 45,
      });
  });

  after(async () => {
    await db.delete(payments).where(eq(payments.companyId, testCompanyId));
    const appts = await db.select({ id: appointments.id }).from(appointments).where(eq(appointments.companyId, testCompanyId));
    for (const a of appts) {
      await db.delete(appointmentServices).where(eq(appointmentServices.appointmentId, a.id));
    }
    await db.delete(appointments).where(eq(appointments.companyId, testCompanyId));
    await db.delete(services).where(eq(services.companyId, testCompanyId));
    await db.delete(employees).where(eq(employees.companyId, testCompanyId));
    await db.delete(clients).where(eq(clients.companyId, testCompanyId));
    await db.delete(locations).where(eq(locations.companyId, testCompanyId));
    await db.delete(companies).where(eq(companies.id, testCompanyId));
    await pool.end();
  });

  it("differentiates Realized vs Projected revenue accurately", async () => {
    // 1. Create a scheduled appointment for R$ 100.00
    const aptScheduledId = crypto.randomUUID();
    await db
      .insert(appointments)
      .values({
        id: aptScheduledId,
        companyId: testCompanyId,
        locationId: testLocationId,
        clientId,
        employeeId,
        appointmentDate: "2026-10-20",
        startTime: "10:00",
        endTime: "10:45",
        status: "scheduled",
        total: "100.00",
      });

    // 2. Create a completed appointment with payment for R$ 80.00
    const aptCompletedId = crypto.randomUUID();
    await db
      .insert(appointments)
      .values({
        id: aptCompletedId,
        companyId: testCompanyId,
        locationId: testLocationId,
        clientId,
        employeeId,
        appointmentDate: "2026-10-20",
        startTime: "11:00",
        endTime: "11:45",
        status: "completed",
        total: "80.00",
      });

    await db.insert(payments).values({
      id: crypto.randomUUID(),
      companyId: testCompanyId,
      appointmentId: aptCompletedId,
      amount: "80.00",
      discount: "0.00",
      method: "PIX",
      status: "paid",
      paidAt: new Date(),
    });

    // Query Projected revenue (sum of active appointments total)
    const [projected] = await db
      .select({
        totalProjected: sql<string>`coalesce(sum(${appointments.total}), 0)`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.companyId, testCompanyId),
          eq(appointments.appointmentDate, "2026-10-20"),
        ),
      );

    // Query Realized revenue (sum of paid payments)
    const [realized] = await db
      .select({
        totalRealized: sql<string>`coalesce(sum(${payments.amount}), 0)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.companyId, testCompanyId),
          eq(payments.status, "paid"),
        ),
      );

    assert.equal(Number(projected.totalProjected), 180.0, "Projected revenue should be 100 + 80 = 180");
    assert.equal(Number(realized.totalRealized), 80.0, "Realized revenue should be only the paid 80.00");

    // Clean up test appointments
    await db.delete(payments).where(eq(payments.companyId, testCompanyId));
    await db.delete(appointments).where(eq(appointments.companyId, testCompanyId));
  });

  it("calculates commission accurately on discounted payments", async () => {
    // Professional has 40% commission on service price (or paid price):
    // 40% of R$ 85.00 = R$ 34.00 (or 40% of R$ 100 = R$ 40)
    const aptId = crypto.randomUUID();
    await db
      .insert(appointments)
      .values({
        id: aptId,
        companyId: testCompanyId,
        locationId: testLocationId,
        clientId,
        employeeId,
        appointmentDate: "2026-10-21",
        startTime: "14:00",
        endTime: "14:45",
        status: "in_progress",
        total: "100.00",
      });

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
        .where(eq(appointments.id, aptId));

      // 2. Snapshot service & commission in appointment_services
      await tx.insert(appointmentServices).values({
        appointmentId: aptId,
        serviceId,
        price: "100.00",
        durationMinutes: 45,
        commissionType: "percentage",
        commissionValue: "40.00",
        commissionAmount,
      });

      // 3. Register payment
      await tx.insert(payments).values({
        id: crypto.randomUUID(),
        companyId: testCompanyId,
        appointmentId: aptId,
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
      .where(eq(payments.appointmentId, aptId));

    assert.ok(paymentRecord, "Payment record must exist");
    assert.equal(paymentRecord.amount, "85.00");
    assert.equal(paymentRecord.discount, "15.00");
    assert.equal(paymentRecord.method, "PIX");
    assert.equal(paymentRecord.status, "paid");

    // Verify Commission snapshot
    const [serviceRecord] = await db
      .select()
      .from(appointmentServices)
      .where(eq(appointmentServices.appointmentId, aptId));

    assert.ok(serviceRecord, "Appointment service snapshot must exist");
    assert.equal(serviceRecord.commissionAmount, "34.00");

    // Clean up
    await db.delete(payments).where(eq(payments.appointmentId, aptId));
    await db.delete(appointmentServices).where(eq(appointmentServices.appointmentId, aptId));
    await db.delete(appointments).where(eq(appointments.id, aptId));
  });

  it("preserves historical prices even when the catalog service price changes", async () => {
    // 1. Complete appointment with service price R$ 100.00
    const aptId = crypto.randomUUID();
    await db
      .insert(appointments)
      .values({
        id: aptId,
        companyId: testCompanyId,
        locationId: testLocationId,
        clientId,
        employeeId,
        appointmentDate: "2026-10-22",
        startTime: "15:00",
        endTime: "15:45",
        status: "completed",
        total: "100.00",
      });

    await db.insert(appointmentServices).values({
      appointmentId: aptId,
      serviceId,
      price: "100.00",
      durationMinutes: 45,
      commissionType: "percentage",
      commissionValue: "40.00",
      commissionAmount: "40.00",
    });

    await db.insert(payments).values({
      id: crypto.randomUUID(),
      companyId: testCompanyId,
      appointmentId: aptId,
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
      .where(eq(appointments.id, aptId));

    assert.equal(historicalApt.aptTotal, "100.00", "Appointment total snapshot must not change");
    assert.equal(historicalApt.servicePrice, "100.00", "Historical service price must not change");

    // Verify catalog reflects new price
    const [catalogService] = await db.select().from(services).where(eq(services.id, serviceId));
    assert.equal(catalogService.price, "150.00", "Catalog price was updated");

    // Clean up
    await db.delete(payments).where(eq(payments.appointmentId, aptId));
    await db.delete(appointmentServices).where(eq(appointmentServices.appointmentId, aptId));
    await db.delete(appointments).where(eq(appointments.id, aptId));
  });
});
