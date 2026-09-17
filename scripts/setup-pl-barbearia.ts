import "dotenv/config";
import { db, pool } from "../src/db";
import { companies, locations, users, subscriptions } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";
import { provisionCompanyTrial } from "../src/lib/subscriptions";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

async function main() {
  try {
    const email = "PLbarbeiraria@gmail.com";
    const normalized = "plbarbeiraria@gmail.com";
    const defaultPassword = "PLbarbeiraria"; // 13 chars matching the screenshot
    const passwordHash = await hashPassword(defaultPassword);

    console.log("Configurando proprietário PL Barbearia...");

    // 1. Procurar ou criar a empresa "PL Barbearia"
    let [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.email, normalized))
      .limit(1);

    if (!company) {
      const companyId = crypto.randomUUID();
      await db.insert(companies).values({
        id: companyId,
        name: "PL Barbearia",
        businessType: "Barbearia",
        phone: "(11) 99999-8888",
        whatsapp: "(11) 99999-8888",
        email: normalized,
        address: "Av. Principal, 100",
        timezone: "America/Sao_Paulo",
        currency: "BRL",
        primaryColor: "#dcff4c",
        secondaryColor: "#14171d",
        publicSlug: "pl-barbearia",
        publicEnabled: true,
        publicColor: "#dcff4c",
        publicPhone: true,
        publicInstagram: false,
        cancellationHours: 2,
        onboarded: true,
      });
      [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
      console.log("✅ Empresa PL Barbearia criada.");
    } else {
      await db.update(companies).set({
        onboarded: true,
        primaryColor: "#dcff4c",
      }).where(eq(companies.id, company.id));
      console.log("✅ Empresa PL Barbearia atualizada.");
    }

    // 2. Garantir Localização
    const [loc] = await db.select().from(locations).where(eq(locations.companyId, company.id)).limit(1);
    if (!loc) {
      await db.insert(locations).values({
        id: crypto.randomUUID(),
        companyId: company.id,
        name: "Matriz",
        address: "Av. Principal, 100",
        phone: "(11) 99999-8888",
        openTime: "09:00",
        closeTime: "19:00",
        active: true,
      });
      console.log("✅ Localização Matriz criada.");
    }

    // 3. Garantir Assinatura Ativa
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.companyId, company.id)).limit(1);
    if (!sub) {
      await provisionCompanyTrial(company.id);
      console.log("✅ Assinatura Trial/Ativa provisionada com sucesso.");
    }

    // 4. Criar ou Atualizar Usuário Proprietário
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalized))
      .limit(1);

    if (existingUser) {
      await db.update(users).set({
        name: "PL Barbearia",
        role: "owner",
        companyId: company.id,
        passwordHash,
        active: true,
        emailVerified: true,
        isSuperadmin: false,
      }).where(eq(users.id, existingUser.id));
      console.log("✅ Usuário proprietário atualizado.");
    } else {
      await db.insert(users).values({
        id: crypto.randomUUID(),
        name: "PL Barbearia",
        email: normalized,
        passwordHash,
        role: "owner",
        companyId: company.id,
        isSuperadmin: false,
        active: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      });
      console.log("✅ Usuário proprietário criado.");
    }

    console.log("\n=======================================================");
    console.log("💈 CONTA DE PROPRIETÁRIO PRONTA:");
    console.log(`E-mail: ${email}`);
    console.log(`Empresa: PL Barbearia`);
    console.log("=======================================================\n");

  } catch (error) {
    console.error("Erro ao configurar PL Barbearia:", error);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
