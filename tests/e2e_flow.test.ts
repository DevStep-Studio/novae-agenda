import "dotenv/config";
import { localDate, shiftDate } from "@/lib/booking/time";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appointmentHistory,
  appointmentServices,
  appointments,
  clients,
  companies,
  employeeLocations,
  employeeSchedules,
  employeeServices,
  employees,
  locations,
  notifications,
  payments,
  services,
  users,
} from "@/db/schema";
import { assertBookable, getAvailabilitySlots } from "@/lib/availability";

describe("E2E Commercial Flow (Prompt Sections 47, 48, 49)", () => {
  let companyId: string;
  let locationId: string;
  let ownerUserId: string;
  let joaoId: string;
  let anaId: string;
  let corteBarbaServiceId: string;
  let carlosClientId: string;
  let appointmentId: string;

  const baseDate = shiftDate(localDate(new Date(), "America/Sao_Paulo"), 7);
  const testDate = shiftDate(baseDate, (9 - new Date(`${baseDate}T12:00:00Z`).getUTCDay()) % 7); // Tuesday

  before(async () => {
    // 1. Criar empresa
    const [comp] = await db
      .insert(companies)
      .values({
        name: "Studio Prime Barbearia",
        timezone: "America/Sao_Paulo",
      })
      .returning();
    companyId = comp.id;

    // 2. Criar conta do proprietário com e-mail confirmado
    const [owner] = await db
      .insert(users)
      .values({
        companyId,
        name: "Proprietário Novae",
        email: "owner@studioprime.com",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz0123456789",
        role: "owner",
        emailVerified: true,
        emailVerifiedAt: new Date(),
      })
      .returning();
    ownerUserId = owner.id;

    // 3. Criar unidade
    const [loc] = await db
      .insert(locations)
      .values({
        companyId,
        name: "Unidade Centro",
        address: "Av. Paulista, 1000",
        openTime: "08:00",
        closeTime: "20:00",
      })
      .returning();
    locationId = loc.id;

    // 4. Cadastrar profissionais (João e Ana)
    const [joao] = await db
      .insert(employees)
      .values({
        companyId,
        locationId,
        name: "João",
        jobTitle: "Master Barber",
        commissionType: "percentage",
        commissionValue: "50.00",
      })
      .returning();
    joaoId = joao.id;

    const [ana] = await db
      .insert(employees)
      .values({
        companyId,
        locationId,
        name: "Ana",
        jobTitle: "Barber Stylist",
        commissionType: "percentage",
        commissionValue: "45.00",
      })
      .returning();
    anaId = ana.id;

    // Vincular profissionais à unidade
    await db.insert(employeeLocations).values([
      { employeeId: joaoId, locationId, isPrimary: true },
      { employeeId: anaId, locationId, isPrimary: true },
    ]);

    // Horários de terça-feira (dayOfWeek = 2) das 09:00 às 19:00
    await db.insert(employeeSchedules).values([
      {
        employeeId: joaoId,
        locationId,
        dayOfWeek: 2,
        startTime: "09:00",
        endTime: "19:00",
        breakStart: "12:00",
        breakEnd: "13:00",
        active: true,
      },
      {
        employeeId: anaId,
        locationId,
        dayOfWeek: 2,
        startTime: "09:00",
        endTime: "19:00",
        breakStart: "12:00",
        breakEnd: "13:00",
        active: true,
      },
    ]);

    // 5. Cadastrar serviço (Corte + Barba, R$ 75,00, 60 min)
    const [serv] = await db
      .insert(services)
      .values({
        companyId,
        name: "Corte + Barba",
        price: "75.00",
        durationMinutes: 60,
      })
      .returning();
    corteBarbaServiceId = serv.id;

    // 6. Cadastrar cliente (Carlos)
    const [client] = await db
      .insert(clients)
      .values({
        companyId,
        name: "Carlos",
        phone: "11977778888",
        email: "carlos@cliente.com",
      })
      .returning();
    carlosClientId = client.id;
  });

  after(async () => {
    // Cleanup
    await db.delete(payments).where(eq(payments.companyId, companyId));
    await db.delete(appointmentServices).where(
      sql`${appointmentServices.appointmentId} IN (SELECT id FROM ${appointments} WHERE company_id = ${companyId})`,
    );
    await db.delete(appointmentHistory).where(
      sql`${appointmentHistory.appointmentId} IN (SELECT id FROM ${appointments} WHERE company_id = ${companyId})`,
    );
    await db.delete(appointments).where(eq(appointments.companyId, companyId));
    await db.delete(employeeSchedules).where(eq(employeeSchedules.employeeId, joaoId));
    await db.delete(employeeSchedules).where(eq(employeeSchedules.employeeId, anaId));
    await db.delete(employeeLocations).where(eq(employeeLocations.employeeId, joaoId));
    await db.delete(employeeLocations).where(eq(employeeLocations.employeeId, anaId));
    await db.delete(employees).where(eq(employees.companyId, companyId));
    await db.delete(services).where(eq(services.companyId, companyId));
    await db.delete(clients).where(eq(clients.companyId, companyId));
    await db.delete(locations).where(eq(locations.companyId, companyId));
    await db.delete(users).where(eq(users.companyId, companyId));
    await db.delete(companies).where(eq(companies.id, companyId));
  });

  it("completes the full commercial lifecycle and validates prompt sections 47, 48, 49", async () => {
    // ----------------------------------------------------
    // ETAPA 1: Verificar disponibilidade de João
    // ----------------------------------------------------
    const slots = await getAvailabilitySlots({
      companyId,
      employeeId: joaoId,
      date: testDate,
      durationMinutes: 60,
      timezone: "America/Sao_Paulo",
    });
    assert.ok(slots.some((s) => s.startTime === "14:00"), "14:00 slot must be initially available for João");

    // ----------------------------------------------------
    // ETAPA 2: Criar agendamento (João, Corte + Barba, 14:00–15:00, R$ 75)
    // ----------------------------------------------------
    const [apt] = await db
      .insert(appointments)
      .values({
        companyId,
        locationId,
        clientId: carlosClientId,
        employeeId: joaoId,
        appointmentDate: testDate,
        startTime: "14:00",
        endTime: "15:00",
        status: "scheduled",
        total: "75.00",
      })
      .returning();
    appointmentId = apt.id;

    await db.insert(appointmentServices).values({
      appointmentId,
      serviceId: corteBarbaServiceId,
      price: "75.00",
      durationMinutes: 60,
      commissionType: "percentage",
      commissionValue: "50.00",
      commissionAmount: "37.50",
    });

    // ----------------------------------------------------
    // ETAPA 3 (SEÇÃO 48): Teste de Conflito
    // Tentar João às 14:30 -> Esperado: BLOQUEADO (409)
    // ----------------------------------------------------
    const conflictCheckJoao = await assertBookable({
      companyId,
      employeeId: joaoId,
      date: testDate,
      durationMinutes: 60,
      timezone: "America/Sao_Paulo",
      startMinutes: 14 * 60 + 30, // 14:30
      endMinutes: 15 * 60 + 30, // 15:30
    });
    assert.equal(conflictCheckJoao.ok, false, "João 14:30 must be BLOQUEADO");
    if (!conflictCheckJoao.ok) {
      assert.equal(conflictCheckJoao.status, 409);
      assert.equal(conflictCheckJoao.error, "Este profissional já possui um atendimento nesse horário.");
    }

    // Tentar Ana às 14:30 -> Esperado: PERMITIDO
    const allowedCheckAna = await assertBookable({
      companyId,
      employeeId: anaId,
      date: testDate,
      durationMinutes: 60,
      timezone: "America/Sao_Paulo",
      startMinutes: 14 * 60 + 30,
      endMinutes: 15 * 60 + 30,
    });
    assert.equal(allowedCheckAna.ok, true, "Ana 14:30 must be PERMITIDO");

    // ----------------------------------------------------
    // ETAPA 4: Fluxo de Status do Atendimento
    // Agendado -> Confirmado -> Chegou (waiting) -> Em atendimento (in_progress)
    // ----------------------------------------------------
    // Confirmar
    await db.update(appointments).set({ status: "confirmed" }).where(eq(appointments.id, appointmentId));
    let [aptCurrent] = await db.select().from(appointments).where(eq(appointments.id, appointmentId));
    assert.equal(aptCurrent.status, "confirmed");

    // Cliente chegou
    await db.update(appointments).set({ status: "waiting" }).where(eq(appointments.id, appointmentId));
    [aptCurrent] = await db.select().from(appointments).where(eq(appointments.id, appointmentId));
    assert.equal(aptCurrent.status, "waiting");

    // Iniciar atendimento
    await db.update(appointments).set({ status: "in_progress" }).where(eq(appointments.id, appointmentId));
    [aptCurrent] = await db.select().from(appointments).where(eq(appointments.id, appointmentId));
    assert.equal(aptCurrent.status, "in_progress");

    // ----------------------------------------------------
    // ETAPA 5 (SEÇÃO 49): Finalizar e Registrar Pagamento PIX (R$ 75,00)
    // ----------------------------------------------------
    await db.transaction(async (tx) => {
      // 1. Status completed
      await tx.update(appointments).set({ status: "completed" }).where(eq(appointments.id, appointmentId));

      // 2. Registrar pagamento
      await tx.insert(payments).values({
        companyId,
        appointmentId,
        amount: "75.00",
        discount: "0.00",
        method: "PIX",
        status: "paid",
        paidAt: new Date(),
      });
    });

    // ----------------------------------------------------
    // ETAPA 6: Validar Métricas no Dashboard (SEÇÃO 49)
    // - Receita realizada + R$ 75
    // - Atendimentos finalizados + 1
    // - Receita de João + R$ 75
    // ----------------------------------------------------
    // Total realizado
    const [realizedRow] = await db
      .select({ total: sql<string>`coalesce(sum(${payments.amount}::numeric), 0)` })
      .from(payments)
      .where(and(eq(payments.companyId, companyId), eq(payments.status, "paid")));
    assert.equal(Number(realizedRow.total), 75.0, "Receita realizada deve ser R$ 75,00");

    // Quantidade de finalizados
    const [completedRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(appointments)
      .where(and(eq(appointments.companyId, companyId), eq(appointments.status, "completed")));
    assert.equal(completedRow.count, 1, "Atendimentos finalizados deve ser 1");

    // Faturamento por profissional (João)
    const [joaoRevenueRow] = await db
      .select({ total: sql<string>`coalesce(sum(${payments.amount}::numeric), 0)` })
      .from(payments)
      .innerJoin(appointments, eq(payments.appointmentId, appointments.id))
      .where(
        and(
          eq(payments.companyId, companyId),
          eq(appointments.employeeId, joaoId),
          eq(payments.status, "paid"),
        ),
      );
    assert.equal(Number(joaoRevenueRow.total), 75.0, "Receita de João deve ser R$ 75,00");

    // ----------------------------------------------------
    // ETAPA 7: Validar Histórico do Cliente (Carlos)
    // - Ficha completa com primeira visita, última visita, total gasto, ticket médio
    // - Atendimento presente no histórico com serviço, profissional, unidade e forma de pagamento
    // ----------------------------------------------------
    const [clientStats] = await db
      .select({
        totalAppointments: sql<number>`count(distinct ${appointments.id})::int`,
        firstVisit: sql<string>`min(${appointments.appointmentDate})::text`,
        lastVisit: sql<string>`max(${appointments.appointmentDate})::text`,
        totalSpent: sql<string>`coalesce(sum(case when ${payments.status} = 'paid' then ${payments.amount}::numeric else 0 end), 0)`,
      })
      .from(appointments)
      .leftJoin(payments, eq(appointments.id, payments.appointmentId))
      .where(
        and(
          eq(appointments.companyId, companyId),
          eq(appointments.clientId, carlosClientId),
          sql`${appointments.status} NOT IN ('cancelled', 'no_show')`,
        ),
      );

    assert.equal(clientStats.totalAppointments, 1);
    assert.equal(clientStats.firstVisit, testDate);
    assert.equal(clientStats.lastVisit, testDate);
    assert.equal(Number(clientStats.totalSpent), 75.0);

    // Consulta do histórico detalhado para a ficha do cliente
    const history = await db
      .select({
        id: appointments.id,
        date: appointments.appointmentDate,
        startTime: appointments.startTime,
        locationName: locations.name,
        employeeName: employees.name,
        amount: payments.amount,
        method: payments.method,
        status: appointments.status,
      })
      .from(appointments)
      .innerJoin(employees, eq(appointments.employeeId, employees.id))
      .leftJoin(locations, eq(appointments.locationId, locations.id))
      .leftJoin(payments, eq(appointments.id, payments.appointmentId))
      .where(eq(appointments.clientId, carlosClientId));

    assert.equal(history.length, 1);
    assert.equal(history[0].employeeName, "João");
    assert.equal(history[0].locationName, "Unidade Centro");
    assert.equal(history[0].amount, "75.00");
    assert.equal(history[0].method, "PIX");
    assert.equal(history[0].status, "completed");
  });
});
