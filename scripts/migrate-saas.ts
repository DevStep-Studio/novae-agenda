import "dotenv/config";
import { pool } from "../src/db";

async function run() {
  console.log("🚀 Executando migrações seguras para SaaS Plans & Subscriptions...");

  // 1. saas_plans table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`saas_plans\` (
      \`id\` varchar(36) NOT NULL,
      \`slug\` varchar(50) NOT NULL,
      \`name\` varchar(100) NOT NULL,
      \`description\` text NOT NULL,
      \`monthly_price\` decimal(12,2) NOT NULL,
      \`annual_price\` decimal(12,2) NOT NULL,
      \`employee_limit\` int NOT NULL,
      \`badge\` varchar(50),
      \`is_active\` boolean NOT NULL DEFAULT true,
      \`sort_order\` int NOT NULL DEFAULT 0,
      \`gateway_plan_id\` varchar(100),
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`saas_plans_slug_idx\` (\`slug\`),
      KEY \`saas_plans_active_idx\` (\`is_active\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. payment_webhook_events table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`payment_webhook_events\` (
      \`id\` varchar(36) NOT NULL,
      \`gateway\` varchar(50) NOT NULL,
      \`event_id\` varchar(255) NOT NULL,
      \`type\` varchar(100) NOT NULL,
      \`payload\` json NOT NULL,
      \`status\` varchar(50) NOT NULL DEFAULT 'processed',
      \`processed_at\` timestamp NOT NULL,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`payment_webhook_events_event_id_idx\` (\`gateway\`, \`event_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  async function addColumnIfNotExists(table: string, column: string, definition: string) {
    const [rows]: any = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    if (rows.length === 0) {
      console.log(`➕ Adicionando coluna ${table}.${column}...`);
      await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    }
  }

  // 3. subscriptions columns
  await addColumnIfNotExists("subscriptions", "plan_id", "varchar(36) NULL");
  await addColumnIfNotExists("subscriptions", "billing_interval", "varchar(20) NOT NULL DEFAULT 'monthly'");
  await addColumnIfNotExists("subscriptions", "amount", "decimal(12,2) NULL");
  await addColumnIfNotExists("subscriptions", "payment_method", "varchar(50) NULL DEFAULT 'pix'");
  await addColumnIfNotExists("subscriptions", "gateway", "varchar(50) NOT NULL DEFAULT 'mercadopago'");
  await addColumnIfNotExists("subscriptions", "gateway_subscription_id", "varchar(100) NULL");
  await addColumnIfNotExists("subscriptions", "gateway_payment_id", "varchar(100) NULL");
  await addColumnIfNotExists("subscriptions", "cancelled_at", "timestamp NULL");

  // 4. subscription_invoices columns
  await addColumnIfNotExists("subscription_invoices", "plan_slug", "varchar(50) NULL");
  await addColumnIfNotExists("subscription_invoices", "billing_interval", "varchar(20) NOT NULL DEFAULT 'monthly'");
  await addColumnIfNotExists("subscription_invoices", "payment_method", "varchar(50) NOT NULL DEFAULT 'pix'");
  await addColumnIfNotExists("subscription_invoices", "due_at", "timestamp NULL");
  await addColumnIfNotExists("subscription_invoices", "pix_qr_code", "text NULL");
  await addColumnIfNotExists("subscription_invoices", "pix_qr_code_base64", "text NULL");
  await addColumnIfNotExists("subscription_invoices", "pix_copia_e_cola", "text NULL");
  await addColumnIfNotExists("subscription_invoices", "pix_expires_at", "timestamp NULL");
  await addColumnIfNotExists("subscription_invoices", "metadata", "json NULL");

  console.log("✅ Todas as colunas e tabelas do SaaS migradas com sucesso!");
  process.exit(0);
}

run().catch((e) => {
  console.error("❌ Erro ao migrar:", e);
  process.exit(1);
});
