ALTER TABLE "booking_waitlist" ADD COLUMN IF NOT EXISTS "location_id" uuid REFERENCES "locations"("id");
ALTER TABLE "booking_waitlist" ADD COLUMN IF NOT EXISTS "employee_id" uuid REFERENCES "employees"("id");
ALTER TABLE "booking_waitlist" ADD COLUMN IF NOT EXISTS "period" text DEFAULT 'any' NOT NULL;
CREATE INDEX IF NOT EXISTS "waitlist_company_date_idx" ON "booking_waitlist" ("company_id", "requested_date", "status");
