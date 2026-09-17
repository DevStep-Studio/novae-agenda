import "dotenv/config";
import { pool, db } from "../src/db";
import { users } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

async function main() {
  try {
    const password = "Admin@Reservei2026";
    const passwordHash = await hashPassword(password);
    console.log("Gerando hash da senha...");

    // 1. Criar ou atualizar admin@reservei.com.br
    const adminEmail = "admin@reservei.com.br";
    const [existingReservei] = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
    if (existingReservei) {
      await db.update(users).set({
        passwordHash,
        isSuperadmin: true,
        active: true,
        emailVerified: true,
      }).where(eq(users.id, existingReservei.id));
      console.log(`✅ Usuário ${adminEmail} atualizado com privilégios de Superadmin.`);
    } else {
      await db.insert(users).values({
        id: crypto.randomUUID(),
        name: "Administrador Geral",
        email: adminEmail,
        passwordHash,
        role: "owner",
        isSuperadmin: true,
        active: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      });
      console.log(`✅ Usuário ${adminEmail} criado com sucesso como Superadmin.`);
    }

    // 2. Garantir superadmin@novae.app
    const superEmail = "superadmin@novae.app";
    const [existingSuper] = await db.select().from(users).where(eq(users.email, superEmail)).limit(1);
    if (existingSuper) {
      await db.update(users).set({
        passwordHash,
        isSuperadmin: true,
        active: true,
        emailVerified: true,
      }).where(eq(users.id, existingSuper.id));
      console.log(`✅ Usuário ${superEmail} atualizado com privilégios de Superadmin.`);
    }

    // 3. Promover admin@studioprime.com.br também para facilitar
    const studioEmail = "admin@studioprime.com.br";
    const [existingStudio] = await db.select().from(users).where(eq(users.email, studioEmail)).limit(1);
    if (existingStudio) {
      await db.update(users).set({
        passwordHash,
        isSuperadmin: true,
        active: true,
      }).where(eq(users.id, existingStudio.id));
      console.log(`✅ Usuário ${studioEmail} promovido a Superadmin.`);
    }

    console.log("\n=======================================================");
    console.log("🔑 ACESSO SUPER ADMIN CRIADO/CONFIGURADO:");
    console.log(`E-mail: ${adminEmail}`);
    console.log(`Senha:  ${password}`);
    console.log("=======================================================\n");

  } catch (error) {
    console.error("Erro ao configurar admin:", error);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
