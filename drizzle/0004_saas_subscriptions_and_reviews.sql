CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "plan" text DEFAULT 'pro_monthly' NOT NULL,
  "status" text DEFAULT 'trialing' NOT NULL,
  "trial_ends_at" timestamp with time zone NOT NULL,
  "current_period_start" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "cancel_at_period_end" boolean DEFAULT false NOT NULL,
  "mercado_pago_subscription_id" text,
  "mercado_pago_payer_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "subscriptions_company_id_unique" UNIQUE ("company_id")
);
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status");

CREATE TABLE IF NOT EXISTS "subscription_invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subscription_id" uuid NOT NULL REFERENCES "subscriptions"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "amount" numeric(10, 2) NOT NULL,
  "status" text DEFAULT 'paid' NOT NULL,
  "paid_at" timestamp with time zone,
  "mercado_pago_payment_id" text,
  "invoice_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "subscription_invoices_company_idx" ON "subscription_invoices"("company_id");

CREATE TABLE IF NOT EXISTS "reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "appointment_id" uuid NOT NULL REFERENCES "appointments"("id") ON DELETE CASCADE,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "service_id" uuid REFERENCES "services"("id") ON DELETE SET NULL,
  "rating" integer NOT NULL CHECK ("rating" >= 1 AND "rating" <= 5),
  "comment" text,
  "status" text DEFAULT 'approved' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "reviews_appointment_id_unique" UNIQUE ("appointment_id")
);
CREATE INDEX IF NOT EXISTS "reviews_company_idx" ON "reviews"("company_id");
CREATE INDEX IF NOT EXISTS "reviews_employee_idx" ON "reviews"("employee_id");
