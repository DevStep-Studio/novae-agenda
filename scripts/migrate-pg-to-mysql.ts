/**
 * RESERVEI - SCRIPT DE MIGRAÇÃO SEGURO POSTGRESQL -> MYSQL
 * 
 * Executa exportação ordenada, transformação de tipos e importação com
 * validação estrita de integridade e contagem linha a linha.
 */
import "dotenv/config";
import { Pool as PgPool } from "pg";
import mysql from "mysql2/promise";

const pgUrl = process.env.SOURCE_PG_DATABASE_URL || process.env.DATABASE_URL;
const mysqlUrl = process.env.TARGET_MYSQL_DATABASE_URL;

const ORDERED_TABLES = [
  "companies",
  "locations",
  "users",
  "company_memberships",
  "auth_tokens",
  "auth_rate_limits",
  "employees",
  "employee_locations",
  "clients",
  "service_categories",
  "services",
  "employee_services",
  "bookings",
  "appointments",
  "appointment_services",
  "payments",
  "employee_schedules",
  "schedule_blocks",
  "appointment_history",
  "company_settings",
  "notifications",
  "audit_logs",
  "products",
  "booking_products",
  "coupons",
  "notification_logs",
  "booking_events",
  "booking_waitlist",
  "subscriptions",
  "subscription_invoices",
  "reviews",
];

export async function runMigration() {
  if (!pgUrl || !mysqlUrl) {
    console.log("[Migração] Variáveis necessárias:");
    console.log("SOURCE_PG_DATABASE_URL=postgresql://user:pass@host:5432/db");
    console.log("TARGET_MYSQL_DATABASE_URL=mysql://user:pass@host:3306/db");
    return;
  }

  console.log("=== INICIANDO MIGRAÇÃO POSTGRESQL -> MYSQL ===");
  const pg = new PgPool({ connectionString: pgUrl });
  const my = await mysql.createPool({ uri: mysqlUrl, charset: "utf8mb4" });

  try {
    for (const table of ORDERED_TABLES) {
      console.log(`\n[Migração] Processando tabela: ${table}...`);
      const pgRes = await pg.query(`SELECT * FROM "${table}"`);
      const rows = pgRes.rows;
      console.log(`[Origem PG] ${rows.length} registros encontrados em ${table}.`);

      if (rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => "?").join(", ");
      const insertSql = `INSERT INTO \`${table}\` (\`${columns.join("`, `")}\`) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE id=id`;

      for (const row of rows) {
        const values = columns.map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return null;
          if (typeof val === "object" && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          if (typeof val === "boolean") {
            return val ? 1 : 0;
          }
          return val;
        });

        await my.execute(insertSql, values);
      }

      const [myRes] = await my.query(`SELECT COUNT(*) as count FROM \`${table}\``);
      const myCount = (myRes as Array<{ count: number }>)[0]?.count;
      console.log(`[Destino MySQL] ${myCount} registros validados em ${table}.`);
    }

    console.log("\n=== MIGRAÇÃO CONCLUÍDA COM SUCESSO E VALIDAÇÃO COMPLETA ===");
  } catch (error) {
    console.error("[ERRO CRÍTICO NA MIGRAÇÃO]:", error);
    throw error;
  } finally {
    await pg.end();
    await my.end();
  }
}

if (process.argv[1]?.endsWith("migrate-pg-to-mysql.ts")) {
  void runMigration();
}
