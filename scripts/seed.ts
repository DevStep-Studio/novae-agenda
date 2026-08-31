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

  const existing = await db.select({ id: companies.id }).from(companies).where(eq(companies.name, "Studio Prime")).limit(1);
  if (existing.length > 0) {
    console.log("Studio Prime já existe. Pulando seed.");
    return;
  }

  const [company] = await db
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

  const passwordHash = await hashPassword("senha123");

  const [owner] = await db
    .insert(users)
    .values({
      companyId: company.id,
      name: "Camila Almeida",
      email: "dono@studioprime.com.br",
      passwordHash,
      role: "owner",
      active: true,
    })
    .returning();

  const [ana] = await db
    .insert(employees)
    .values({ companyId: company.id, name: "Ana Costa", jobTitle: "Profissional", phone: "(11) 98842-1200", active: true })
    .returning();

  const [joao] = await db
    .insert(employees)
    .values({ companyId: company.id, name: "João Mendes", jobTitle: "Profissional", phone: "(11) 99120-4432", active: true })
    .returning();

  const [client] = await db
    .insert(clients)
    .values({ companyId: company.id, name: "Carlos Silva", phone: "(11) 99999-9999", email: "carlos.silva@email.com", active: true })
    .returning();

  const [corte] = await db
    .insert(services)
    .values({ companyId: company.id, name: "Corte", price: "50.00", durationMinutes: 30, active: true })
    .returning();

  const [barba] = await db
    .insert(services)
    .values({ companyId: company.id, name: "Barba", price: "35.00", durationMinutes: 30, active: true })
    .returning();

  const [corteBarba] = await db
    .insert(services)
    .values({ companyId: company.id, name: "Corte + Barba", price: "75.00", durationMinutes: 60, active: true })
    .returning();

  await db.insert(employeeServices).values([
    { employeeId: ana.id, serviceId: corte.id },
    { employeeId: joao.id, serviceId: corte.id },
    { employeeId: joao.id, serviceId: barba.id },
    { employeeId: joao.id, serviceId: corteBarba.id },
  ]);

  console.log("Seed concluído:", {
    company: company.id,
    owner: owner.id,
    ana: ana.id,
    joao: joao.id,
    client: client.id,
  });
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Falha no seed:", error);
    process.exit(1);
  });

export { appointments };
