import "dotenv/config";
import { pool } from "@/db";

async function main() {
  const conn = await pool.getConnection();
  try {
    console.log("Creating customer membership tables...");

    await conn.query(`
      CREATE TABLE IF NOT EXISTS membership_plans (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        image_url TEXT,
        price DECIMAL(12, 2) NOT NULL,
        billing_period VARCHAR(50) NOT NULL DEFAULT 'monthly',
        frequency_type VARCHAR(50) NOT NULL DEFAULT 'WEEKLY_CALENDAR_BASED',
        sessions_per_period INT NOT NULL DEFAULT 4,
        weekly_frequency INT NOT NULL DEFAULT 1,
        allow_reschedule BOOLEAN NOT NULL DEFAULT TRUE,
        reschedule_hours_notice INT NOT NULL DEFAULT 2,
        allow_carry_over BOOLEAN NOT NULL DEFAULT FALSE,
        no_show_consumes_session BOOLEAN NOT NULL DEFAULT TRUE,
        late_cancel_consumes_session BOOLEAN NOT NULL DEFAULT TRUE,
        badge_color VARCHAR(50) DEFAULT '#dcff4c',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX membership_plans_company_idx (company_id),
        CONSTRAINT fk_mp_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS membership_plan_services (
        membership_plan_id VARCHAR(36) NOT NULL,
        service_id VARCHAR(36) NOT NULL,
        PRIMARY KEY (membership_plan_id, service_id),
        CONSTRAINT fk_mps_plan FOREIGN KEY (membership_plan_id) REFERENCES membership_plans(id) ON DELETE CASCADE,
        CONSTRAINT fk_mps_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS membership_plan_employees (
        membership_plan_id VARCHAR(36) NOT NULL,
        employee_id VARCHAR(36) NOT NULL,
        PRIMARY KEY (membership_plan_id, employee_id),
        CONSTRAINT fk_mpe_plan FOREIGN KEY (membership_plan_id) REFERENCES membership_plans(id) ON DELETE CASCADE,
        CONSTRAINT fk_mpe_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS customer_memberships (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) NOT NULL,
        client_id VARCHAR(36) NOT NULL,
        membership_plan_id VARCHAR(36) NOT NULL,
        starts_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ends_at TIMESTAMP NULL DEFAULT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        preferred_professional_id VARCHAR(36) NULL,
        preferred_weekdays JSON NOT NULL,
        preferred_time TIME NULL,
        monthly_price_snapshot DECIMAL(12, 2) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX customer_memberships_company_idx (company_id),
        INDEX customer_memberships_client_idx (client_id),
        INDEX customer_memberships_plan_idx (membership_plan_id),
        INDEX customer_memberships_status_idx (company_id, status),
        CONSTRAINT fk_cm_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        CONSTRAINT fk_cm_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        CONSTRAINT fk_cm_plan FOREIGN KEY (membership_plan_id) REFERENCES membership_plans(id) ON DELETE CASCADE,
        CONSTRAINT fk_cm_employee FOREIGN KEY (preferred_professional_id) REFERENCES employees(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS membership_periods (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) NOT NULL,
        customer_membership_id VARCHAR(36) NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        session_allowance INT NOT NULL,
        sessions_booked INT NOT NULL DEFAULT 0,
        sessions_used INT NOT NULL DEFAULT 0,
        payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
        paid_at TIMESTAMP NULL DEFAULT NULL,
        payment_method VARCHAR(50) NULL DEFAULT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX membership_periods_membership_idx (customer_membership_id),
        INDEX membership_periods_range_idx (company_id, period_start, period_end),
        INDEX membership_periods_pay_status_idx (company_id, payment_status),
        CONSTRAINT fk_mpd_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        CONSTRAINT fk_mpd_membership FOREIGN KEY (customer_membership_id) REFERENCES customer_memberships(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS booking_membership_usage (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) NOT NULL,
        appointment_id VARCHAR(36) NOT NULL,
        customer_membership_id VARCHAR(36) NOT NULL,
        membership_period_id VARCHAR(36) NOT NULL,
        service_id VARCHAR(36) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'booked',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE INDEX booking_membership_usage_appointment_idx (appointment_id),
        INDEX booking_membership_usage_period_idx (membership_period_id),
        INDEX booking_membership_usage_membership_idx (customer_membership_id),
        CONSTRAINT fk_bmu_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        CONSTRAINT fk_bmu_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
        CONSTRAINT fk_bmu_membership FOREIGN KEY (customer_membership_id) REFERENCES customer_memberships(id) ON DELETE CASCADE,
        CONSTRAINT fk_bmu_period FOREIGN KEY (membership_period_id) REFERENCES membership_periods(id) ON DELETE CASCADE,
        CONSTRAINT fk_bmu_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS customer_membership_payments (
        id VARCHAR(36) PRIMARY KEY,
        company_id VARCHAR(36) NOT NULL,
        customer_membership_id VARCHAR(36) NOT NULL,
        membership_period_id VARCHAR(36) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        method VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'paid',
        paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX cust_membership_payments_company_idx (company_id),
        INDEX cust_membership_payments_period_idx (membership_period_id),
        CONSTRAINT fk_cmp_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        CONSTRAINT fk_cmp_membership FOREIGN KEY (customer_membership_id) REFERENCES customer_memberships(id) ON DELETE CASCADE,
        CONSTRAINT fk_cmp_period FOREIGN KEY (membership_period_id) REFERENCES membership_periods(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Customer membership tables created successfully!");
  } finally {
    conn.release();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
