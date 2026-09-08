CREATE TABLE "booking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"event" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_products" (
	"booking_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	CONSTRAINT "booking_products_booking_id_product_id_pk" PRIMARY KEY("booking_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "booking_waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"requested_date" date NOT NULL,
	"service_ids" jsonb NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"payment_type" text DEFAULT 'PAY_LATER' NOT NULL,
	"source" text DEFAULT 'PUBLIC_LINK' NOT NULL,
	"notes" text,
	"coupon_code" text,
	"idempotency_key" uuid NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"event" text NOT NULL,
	"revision" integer NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "company_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "booking_id" uuid;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "source" text DEFAULT 'ADMIN' NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "buffer_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "public_slug" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "public_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "public_description" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "public_color" text DEFAULT '#234e3d' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "public_photos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "public_phone" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "public_instagram" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "cancellation_hours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "allow_products" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "buffer_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "delivery_mode" text DEFAULT 'IN_PERSON' NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "payment_type" text DEFAULT 'PAY_LATER' NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "deposit_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "cancellation_policy" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_products" ADD CONSTRAINT "booking_products_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_products" ADD CONSTRAINT "booking_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_waitlist" ADD CONSTRAINT "booking_waitlist_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_waitlist" ADD CONSTRAINT "booking_waitlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_events_company_event_idx" ON "booking_events" USING btree ("company_id","event","created_at");--> statement-breakpoint
CREATE INDEX "bookings_user_start_idx" ON "bookings" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_company_start_idx" ON "bookings" USING btree ("company_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_user_request_idx" ON "bookings" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_company_code_idx" ON "coupons" USING btree ("company_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_logs_dedupe_idx" ON "notification_logs" USING btree ("booking_id","event","revision","channel");--> statement-breakpoint
CREATE INDEX "notification_logs_queue_idx" ON "notification_logs" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "products_company_idx" ON "products" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_company_user_idx" ON "clients" USING btree ("company_id","user_id");--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_public_slug_unique" UNIQUE("public_slug");
--> statement-breakpoint
-- Old blocks encoded local wall time with a Z suffix. Convert once, preserving their intended local time.
UPDATE schedule_blocks b SET starts_at = (b.starts_at AT TIME ZONE 'UTC') AT TIME ZONE c.timezone,
ends_at = (b.ends_at AT TIME ZONE 'UTC') AT TIME ZONE c.timezone FROM companies c WHERE c.id=b.company_id;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
-- Protect every entry point, including manual scheduling and direct SQL.
-- Existing overlaps must be resolved explicitly before this migration can succeed.
ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
EXCLUDE USING gist (employee_id WITH =, tsrange(appointment_date + start_time, appointment_date + end_time + buffer_minutes * interval '1 minute', '[)') WITH &&)
WHERE (status NOT IN ('cancelled','no_show'));
--> statement-breakpoint
ALTER TABLE appointments ADD CONSTRAINT appointments_valid_span CHECK (end_time > start_time AND buffer_minutes >= 0) NOT VALID;
ALTER TABLE users ADD CONSTRAINT users_tenant_role CHECK ((role = 'customer' AND company_id IS NULL) OR (role <> 'customer' AND company_id IS NOT NULL)) NOT VALID;
CREATE UNIQUE INDEX users_customer_email_idx ON users (lower(email)) WHERE role='customer';
CREATE INDEX appointments_booking_idx ON appointments(booking_id);
CREATE INDEX schedule_blocks_company_span_idx ON schedule_blocks(company_id, starts_at, ends_at);
CREATE INDEX employee_schedules_employee_day_idx ON employee_schedules(employee_id, day_of_week);
ALTER TABLE services ADD CONSTRAINT services_booking_values CHECK(duration_minutes > 0 AND buffer_minutes >= 0 AND price >= 0 AND deposit_amount >= 0 AND deposit_amount <= price) NOT VALID;
ALTER TABLE bookings ADD CONSTRAINT bookings_valid_values CHECK(ends_at > starts_at AND total >= 0 AND discount >= 0 AND subtotal >= discount);
