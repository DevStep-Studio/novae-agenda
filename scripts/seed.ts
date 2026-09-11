import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  appointmentServices,
  appointments,
  clients,
  companies,
  employeeSchedules,
  employeeServices,
  employees,
  payments,
  services,
  users,
} from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";

function dateKey(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function seed() {
  console.log("Seeding database...");

  let [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.name, "Studio Prime"))
    .limit(1);

  if (!company) {
    const companyId = crypto.randomUUID();
    await db
      .insert(companies)
      .values({
        id: companyId,
        name: "Studio Prime",
        businessType: "Barbearia",
        phone: "(11) 3042-1980",
        whatsapp: "(11) 99842-1200",
        email: "ola@studioprime.com.br",
        address: "Rua Harmonia, 284 - Vila Madalena, São Paulo",
        instagram: "studioprime",
        timezone: "America/Sao_Paulo",
        currency: "BRL",
        primaryColor: "#dcff4c",
        secondaryColor: "#162a22",
        publicSlug: "studio-prime",
        publicEnabled: true,
        onboarded: true,
      });
    [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
  } else {
    await db
      .update(companies)
      .set({
        publicSlug: "studio-prime",
        publicEnabled: true,
      })
      .where(eq(companies.id, company.id));
    [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, company.id))
      .limit(1);
  }

  const defaultPasswordHash = await hashPassword("senha123");
  const verified = { emailVerified: true, emailVerifiedAt: new Date() };

  // Admin / Owner
  let [adminUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, "admin@studioprime.com.br"))
    .limit(1);

  if (!adminUser) {
    const adminId = crypto.randomUUID();
    await db.insert(users).values({
      id: adminId,
      companyId: company.id,
      name: "Administrador (Lucas Ferreira)",
      email: "admin@studioprime.com.br",
      passwordHash: defaultPasswordHash,
      role: "admin",
      active: true,
      ...verified,
    });
    [adminUser] = await db.select().from(users).where(eq(users.id, adminId)).limit(1);
  } else {
    await db.update(users).set({ role: "admin" }).where(eq(users.id, adminUser.id));
  }

  // Also maintain dono@studioprime.com.br
  const [existingDono] = await db
    .select()
    .from(users)
    .where(eq(users.email, "dono@studioprime.com.br"))
    .limit(1);

  if (!existingDono) {
    await db.insert(users).values({
      id: crypto.randomUUID(),
      companyId: company.id,
      name: "Camila Almeida (Dona)",
      email: "dono@studioprime.com.br",
      passwordHash: defaultPasswordHash,
      role: "owner",
      active: true,
      ...verified,
    });
  }

  // Standard User / Employee / Manager
  let [normalUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, "usuario@studioprime.com.br"))
    .limit(1);

  if (!normalUser) {
    const normalId = crypto.randomUUID();
    await db.insert(users).values({
      id: normalId,
      companyId: company.id,
      name: "Ana Costa",
      email: "usuario@studioprime.com.br",
      passwordHash: defaultPasswordHash,
      role: "manager",
      active: true,
      ...verified,
    });
    [normalUser] = await db.select().from(users).where(eq(users.id, normalId)).limit(1);
  }

  // Employee (Profissional)
  const [existingFunc] = await db
    .select()
    .from(users)
    .where(eq(users.email, "funcionario@studioprime.com.br"))
    .limit(1);

  if (!existingFunc) {
    await db.insert(users).values({
      id: crypto.randomUUID(),
      companyId: company.id,
      name: "João Mendes",
      email: "funcionario@studioprime.com.br",
      phone: "(11) 99120-4432",
      passwordHash: defaultPasswordHash,
      role: "employee",
      active: true,
      ...verified,
    });
  }

  // Client User
  const [existingClient] = await db.select().from(users).where(eq(users.email, "cliente@email.com")).limit(1);
  if (!existingClient) {
    await db.insert(users).values({
      id: crypto.randomUUID(),
      name: "Carlos Silva",
      email: "cliente@email.com",
      phone: "(11) 99999-9999",
      passwordHash: defaultPasswordHash,
      role: "customer",
      active: true,
      ...verified,
    });
  }

  // Superadmin User
  const [existingSuper] = await db.select().from(users).where(eq(users.email, "superadmin@novae.app")).limit(1);
  if (!existingSuper) {
    await db.insert(users).values({
      id: crypto.randomUUID(),
      name: "Superadmin Novae",
      email: "superadmin@novae.app",
      passwordHash: defaultPasswordHash,
      role: "owner",
      isSuperadmin: true,
      active: true,
      ...verified,
    });
  }

  // Ensure employees exist and link to users
  let [ana] = await db.select().from(employees).where(eq(employees.name, "Ana Costa")).limit(1);
  if (!ana) {
    const anaId = crypto.randomUUID();
    await db.insert(employees).values({
      id: anaId,
      companyId: company.id,
      userId: normalUser.id,
      name: "Ana Costa",
      jobTitle: "Profissional",
      phone: "(11) 98842-1200",
      active: true,
    });
    [ana] = await db.select().from(employees).where(eq(employees.id, anaId)).limit(1);
  } else {
    await db.update(employees).set({ userId: normalUser.id }).where(eq(employees.id, ana.id));
  }

  let [joao] = await db.select().from(employees).where(eq(employees.name, "João Mendes")).limit(1);
  if (!joao) {
    const joaoId = crypto.randomUUID();
    await db.insert(employees).values({
      id: joaoId,
      companyId: company.id,
      name: "João Mendes",
      jobTitle: "Profissional",
      phone: "(11) 99120-4432",
      active: true,
    });
    [joao] = await db.select().from(employees).where(eq(employees.id, joaoId)).limit(1);
  }

  // Client
  let [client] = await db.select().from(clients).where(eq(clients.email, "carlos.silva@email.com")).limit(1);
  if (!client) {
    const clientId = crypto.randomUUID();
    await db.insert(clients).values({
      id: clientId,
      companyId: company.id,
      name: "Carlos Silva",
      phone: "(11) 99999-9999",
      email: "carlos.silva@email.com",
      photoUrl: "/avatars/carlos.jpg",
      active: true,
    });
    [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  }

  // Services
  let [corte] = await db.select().from(services).where(eq(services.name, "Corte")).limit(1);
  if (!corte) {
    const corteId = crypto.randomUUID();
    await db.insert(services).values({
      id: corteId,
      companyId: company.id,
      name: "Corte",
      price: "50.00",
      durationMinutes: 30,
      active: true,
    });
    [corte] = await db.select().from(services).where(eq(services.id, corteId)).limit(1);
  }

  let [barba] = await db.select().from(services).where(eq(services.name, "Barba")).limit(1);
  if (!barba) {
    const barbaId = crypto.randomUUID();
    await db.insert(services).values({
      id: barbaId,
      companyId: company.id,
      name: "Barba",
      price: "35.00",
      durationMinutes: 30,
      active: true,
    });
    [barba] = await db.select().from(services).where(eq(services.id, barbaId)).limit(1);
  }

  let [corteBarba] = await db.select().from(services).where(eq(services.name, "Corte + Barba")).limit(1);
  if (!corteBarba) {
    const cbId = crypto.randomUUID();
    await db.insert(services).values({
      id: cbId,
      companyId: company.id,
      name: "Corte + Barba",
      price: "75.00",
      durationMinutes: 60,
      active: true,
    });
    [corteBarba] = await db.select().from(services).where(eq(services.id, cbId)).limit(1);
  }

  // Second client
  let [mariana] = await db.select().from(clients).where(eq(clients.email, "mariana.souza@email.com")).limit(1);
  if (!mariana) {
    const mId = crypto.randomUUID();
    await db.insert(clients).values({
      id: mId,
      companyId: company.id,
      name: "Mariana Souza",
      phone: "(11) 98888-1122",
      email: "mariana.souza@email.com",
      photoUrl: "/avatars/mariana.jpg",
      active: true,
    });
    [mariana] = await db.select().from(clients).where(eq(clients.id, mId)).limit(1);
  }

  // Employee ↔ service links, with commissions
  const links: Array<{ employeeId: string; serviceId: string; commissionType: string; commissionValue: string }> = [
    { employeeId: joao.id, serviceId: corte.id, commissionType: "percentage", commissionValue: "40" },
    { employeeId: joao.id, serviceId: barba.id, commissionType: "percentage", commissionValue: "40" },
    { employeeId: joao.id, serviceId: corteBarba.id, commissionType: "percentage", commissionValue: "40" },
    { employeeId: ana.id, serviceId: corte.id, commissionType: "percentage", commissionValue: "50" },
    { employeeId: ana.id, serviceId: corteBarba.id, commissionType: "percentage", commissionValue: "50" },
  ];
  for (const link of links) {
    await db.delete(employeeServices).where(eq(employeeServices.employeeId, link.employeeId));
    await db.insert(employeeServices).values(link);
  }

  // Weekday schedules (Mon–Sat 09:00–18:00, lunch 12:00–13:00) for both professionals
  for (const emp of [ana, joao]) {
    await db.delete(employeeSchedules).where(eq(employeeSchedules.employeeId, emp.id));
    for (const dow of [1, 2, 3, 4, 5, 6]) {
      await db.insert(employeeSchedules).values({
        id: crypto.randomUUID(),
        employeeId: emp.id,
        dayOfWeek: dow,
        startTime: "09:00:00",
        endTime: "18:00:00",
        breakStart: "12:00:00",
        breakEnd: "13:00:00",
        active: true,
      });
    }
  }

  // Demo appointments — only when the company has none yet, so re-seeding stays clean.
  const [existingApt] = await db.select({ id: appointments.id }).from(appointments).where(eq(appointments.companyId, company.id)).limit(1);
  if (!existingApt) {
    type Demo = {
      client: string; employee: string; service: string; price: number; duration: number;
      commission: number; date: string; start: string; status: string; paid: boolean; method?: string;
    };
    const demos: Demo[] = [
      { client: client.id, employee: ana.id, service: corte.id, price: 50, duration: 30, commission: 25, date: dateKey(0), start: "09:00:00", status: "confirmed", paid: false },
      { client: mariana.id, employee: joao.id, service: corteBarba.id, price: 75, duration: 60, commission: 30, date: dateKey(0), start: "10:30:00", status: "scheduled", paid: false },
      { client: client.id, employee: joao.id, service: barba.id, price: 35, duration: 30, commission: 14, date: dateKey(0), start: "14:00:00", status: "in_progress", paid: false },
      { client: mariana.id, employee: ana.id, service: corteBarba.id, price: 75, duration: 60, commission: 37.5, date: dateKey(-1), start: "11:00:00", status: "completed", paid: true, method: "pix" },
      { client: client.id, employee: joao.id, service: corte.id, price: 50, duration: 30, commission: 20, date: dateKey(-2), start: "15:00:00", status: "completed", paid: true, method: "credit" },
      { client: mariana.id, employee: joao.id, service: corteBarba.id, price: 75, duration: 60, commission: 30, date: dateKey(-4), start: "16:00:00", status: "completed", paid: true, method: "cash" },
      { client: client.id, employee: ana.id, service: corte.id, price: 50, duration: 30, commission: 25, date: dateKey(-6), start: "10:00:00", status: "completed", paid: true, method: "debit" },
    ];

    for (const d of demos) {
      const endMin = Number(d.start.slice(0, 2)) * 60 + Number(d.start.slice(3, 5)) + d.duration;
      const end = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}:00`;
      const aptId = crypto.randomUUID();
      await db
        .insert(appointments)
        .values({
          id: aptId,
          companyId: company.id,
          clientId: d.client,
          employeeId: d.employee,
          appointmentDate: d.date,
          startTime: d.start,
          endTime: end,
          status: d.status,
          total: d.price.toFixed(2),
        });
      await db.insert(appointmentServices).values({
        appointmentId: aptId,
        serviceId: d.service,
        price: d.price.toFixed(2),
        durationMinutes: d.duration,
        commissionType: "percentage",
        commissionValue: "40",
        commissionAmount: d.commission.toFixed(2),
      });
      if (d.paid) {
        await db.insert(payments).values({
          id: crypto.randomUUID(),
          companyId: company.id,
          appointmentId: aptId,
          amount: d.price.toFixed(2),
          method: d.method ?? "pix",
          status: "paid",
          paidAt: new Date(`${d.date}T${d.start}`),
        });
      }
    }
    console.log(`  ${demos.length} atendimentos de demonstração criados.`);
  }

  console.log("\n✅ Seed executado com sucesso!");
  console.log("---------------------------------------------------------------------------------");
  console.log("NÍVEL          | E-MAIL                         | SENHA    | PORTAL");
  console.log("---------------------------------------------------------------------------------");
  console.log("Superadmin (5) | superadmin@novae.app           | senha123 | /admin");
  console.log("Owner (4)      | dono@studioprime.com.br        | senha123 | /gestao");
  console.log("Admin (3)      | admin@studioprime.com.br       | senha123 | /gestao");
  console.log("Manager (2)    | usuario@studioprime.com.br     | senha123 | /gestao");
  console.log("Employee (1)   | funcionario@studioprime.com.br | senha123 | /profissional");
  console.log("Client (0)     | cliente@email.com              | senha123 | /cliente");
  console.log("---------------------------------------------------------------------------------\n");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Falha no seed:", error);
    process.exit(1);
  });

export { appointments };
