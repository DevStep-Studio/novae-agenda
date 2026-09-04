ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "open_time" time DEFAULT '08:00' NOT NULL;
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "close_time" time DEFAULT '19:00' NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_superadmin" boolean DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");
CREATE TABLE IF NOT EXISTS "employee_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "employee_locations_emp_loc_idx" ON "employee_locations" USING btree ("employee_id", "location_id");
DO $$ BEGIN
 ALTER TABLE "employee_locations" ADD CONSTRAINT "employee_locations_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
 ALTER TABLE "employee_locations" ADD CONSTRAINT "employee_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
ALTER TABLE "employee_schedules" ADD COLUMN IF NOT EXISTS "location_id" uuid;
DO $$ BEGIN
 ALTER TABLE "employee_schedules" ADD CONSTRAINT "employee_schedules_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "discount" numeric(10, 2) DEFAULT '0' NOT NULL;
