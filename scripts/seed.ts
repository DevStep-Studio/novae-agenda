import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  appointments,
  clients,
  companies,
  employeeServices,
  employees,
  services,
  users,
} from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";

async function seed() {
  console.log("Seeding database...");

  let [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.name, "Studio Prime"))
    .limit(1);

  if (!company) {
    [company] = await db
      .insert(companies)
      .values({
        name: "Studio Prime",
        businessType: "Barbearia",
        phone: "(11) 3042-1980",
        whatsapp: "(11) 99842-1200",
        email: "ola@studioprime.com.br",
        address: "Rua Harmonia, 284 - Vila Madalena, São Paulo",
        instagram: "studioprime",
        timezone: "America/Sao_Paulo",
        currency: "BRL",
        primaryColor: "#1f6f66",
        secondaryColor: "#eaf4f1",
        onboarded: true,
      })
      .returning();
  }

  const defaultPasswordHash = await hashPassword("senha123");

  // Admin / Owner
  const [adminUser] = await db
    .insert(users)
    .values({
      companyId: company.id,
      name: "Administrador (Camila Almeida)",
      email: "admin@studioprime.com.br",
      passwordHash: defaultPasswordHash,
      role: "owner",
      active: true,
    })
    .onConflictDoUpdate({
      target: [users.companyId, users.email],
      set: { role: "owner", passwordHash: defaultPasswordHash, active: true },
    })
    .returning();

  // Also maintain dono@studioprime.com.br
  await db
    .insert(users)
    .values({
      companyId: company.id,
      name: "Camila Almeida (Dona)",
      email: "dono@studioprime.com.br",
      passwordHash: defaultPasswordHash,
      role: "owner",
      active: true,
    })
    .onConflictDoUpdate({
      target: [users.companyId, users.email],
      set: { role: "owner", passwordHash: defaultPasswordHash, active: true },
    });

  // Standard User / Employee
  const [normalUser] = await db
    .insert(users)
    .values({
      companyId: company.id,
      name: "Ana Costa",
      email: "usuario@studioprime.com.br",
      passwordHash: defaultPasswordHash,
      role: "employee",
      active: true,
    })
    .onConflictDoUpdate({
      target: [users.companyId, users.email],
      set: { role: "employee", passwordHash: defaultPasswordHash, active: true },
    })
    .returning();

  // Ensure employees exist and link to users
  let [ana] = await db.select().from(employees).where(eq(employees.name, "Ana Costa")).limit(1);
  if (!ana) {
    [ana] = await db
      .insert(employees)
      .values({
        companyId: company.id,
        userId: normalUser.id,
        name: "Ana Costa",
        jobTitle: "Profissional",
        phone: "(11) 98842-1200",
        active: true,
      })
      .returning();
  } else {
    await db.update(employees).set({ userId: normalUser.id }).where(eq(employees.id, ana.id));
  }

  let [joao] = await db.select().from(employees).where(eq(employees.name, "João Mendes")).limit(1);
  if (!joao) {
    [joao] = await db
      .insert(employees)
      .values({
        companyId: company.id,
        name: "João Mendes",
        jobTitle: "Profissional",
        phone: "(11) 99120-4432",
        active: true,
      })
      .returning();
  }

  // Client
  let [client] = await db.select().from(clients).where(eq(clients.email, "carlos.silva@email.com")).limit(1);
  if (!client) {
    [client] = await db
      .insert(clients)
      .values({
        companyId: company.id,
        name: "Carlos Silva",
        phone: "(11) 99999-9999",
        email: "carlos.silva@email.com",
        active: true,
      })
      .returning();
  }

  // Services
  let [corte] = await db.select().from(services).where(eq(services.name, "Corte")).limit(1);
  if (!corte) {
    [corte] = await db
      .insert(services)
      .values({ companyId: company.id, name: "Corte", price: "50.00", durationMinutes: 30, active: true })
      .returning();
  }

  let [barba] = await db.select().from(services).where(eq(services.name, "Barba")).limit(1);
  if (!barba) {
    [barba] = await db
      .insert(services)
      .values({ companyId: company.id, name: "Barba", price: "35.00", durationMinutes: 30, active: true })
      .returning();
  }

  let [corteBarba] = await db.select().from(services).where(eq(services.name, "Corte + Barba")).limit(1);
  if (!corteBarba) {
    [corteBarba] = await db
      .insert(services)
      .values({ companyId: company.id, name: "Corte + Barba", price: "75.00", durationMinutes: 60, active: true })
      .returning();
  }

  console.log("Seed executado com sucesso!");
  console.log({
    admin: adminUser.email,
    user: normalUser.email,
  });
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Falha no seed:", error);
    process.exit(1);
  });

export { appointments };
