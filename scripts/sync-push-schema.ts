import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Verificando e criando tabelas push_devices e notification_schedules...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS push_devices (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NULL,
      customer_id VARCHAR(36) NULL,
      company_id VARCHAR(36) NULL,
      provider VARCHAR(50) NOT NULL DEFAULT 'expo',
      push_token VARCHAR(255) NOT NULL,
      platform VARCHAR(20) NOT NULL DEFAULT 'unknown',
      device_identifier VARCHAR(100) NULL,
      app_version VARCHAR(50) NULL,
      environment VARCHAR(20) NOT NULL DEFAULT 'production',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_success_at TIMESTAMP NULL,
      last_failure_at TIMESTAMP NULL,
      last_error TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY push_devices_token_idx (push_token),
      INDEX push_devices_user_idx (user_id, is_active),
      INDEX push_devices_customer_idx (customer_id, is_active),
      INDEX push_devices_company_idx (company_id, is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS notification_schedules (
      id VARCHAR(36) PRIMARY KEY,
      booking_id VARCHAR(36) NOT NULL,
      company_id VARCHAR(36) NOT NULL,
      event_type VARCHAR(50) NOT NULL,
      recipient_type VARCHAR(20) NOT NULL,
      recipient_id VARCHAR(36) NULL,
      scheduled_for TIMESTAMP NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      attempts INT NOT NULL DEFAULT 0,
      sent_at TIMESTAMP NULL,
      cancelled_at TIMESTAMP NULL,
      idempotency_key VARCHAR(128) NOT NULL,
      last_error TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY notification_schedules_idempotency_idx (idempotency_key),
      INDEX notification_schedules_queue_idx (status, scheduled_for),
      INDEX notification_schedules_booking_idx (booking_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("Tabelas push_devices e notification_schedules sincronizadas com sucesso!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro ao sincronizar tabelas:", err);
  process.exit(1);
});
