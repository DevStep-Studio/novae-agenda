import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  businessType: text("business_type"),
  logoUrl: text("logo_url"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  address: text("address"),
  instagram: text("instagram"),
  website: text("website"),
  timezone: text("timezone").default("America/Sao_Paulo").notNull(),
  currency: text("currency").default("BRL").notNull(),
  primaryColor: text("primary_color").default("#dcff4c").notNull(),
  secondaryColor: text("secondary_color").default("#162a22").notNull(),
  publicSlug: text("public_slug").unique(),
  publicEnabled: boolean("public_enabled").default(false).notNull(),
  publicDescription: text("public_description"),
  publicColor: text("public_color").default("#234e3d").notNull(),
  publicPhotos: jsonb("public_photos").$type<string[]>().default([]).notNull(),
  publicPhone: boolean("public_phone").default(false).notNull(),
  publicInstagram: boolean("public_instagram").default(false).notNull(),
  cancellationHours: integer("cancellation_hours").default(24).notNull(),
  allowProducts: boolean("allow_products").default(false).notNull(),
  onboarded: boolean("onboarded").default(false).notNull(),
  ...timestamps,
});

export const locations = pgTable("locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  openTime: time("open_time").default("08:00").notNull(),
  closeTime: time("close_time").default("19:00").notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => ({ companyIdx: index("locations_company_idx").on(table.companyId) }));

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id),
  phone: text("phone"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").default("employee").notNull(),
  isSuperadmin: boolean("is_superadmin").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  ...timestamps,
}, (table) => ({
  emailCompanyIdx: uniqueIndex("users_company_email_idx").on(table.companyId, table.email),
  emailIdx: index("users_email_idx").on(table.email),
}));

// One-time tokens for email verification and password reset.
// Only the SHA-256 hash of the token is stored; the raw token lives only in the e-mail link.
export const authTokens = pgTable("auth_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // 'email_verification' | 'password_reset'
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tokenHashIdx: uniqueIndex("auth_tokens_hash_idx").on(table.tokenHash),
  userKindIdx: index("auth_tokens_user_kind_idx").on(table.userId, table.kind),
}));

// Sliding-window counters for auth endpoints (login, register, password reset).
export const authRateLimits = pgTable("auth_rate_limits", {
  id: uuid("id").defaultRandom().primaryKey(),
  bucket: text("bucket").notNull(), // e.g. "login:ip:1.2.3.4" or "login:email:foo@bar.com"
  hits: integer("hits").default(0).notNull(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).defaultNow().notNull(),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
}, (table) => ({
  bucketIdx: uniqueIndex("auth_rate_limits_bucket_idx").on(table.bucket),
}));

export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  locationId: uuid("location_id").references(() => locations.id),
  userId: uuid("user_id").references(() => users.id),
  name: text("name").notNull(),
  photoUrl: text("photo_url"),
  phone: text("phone"),
  jobTitle: text("job_title"),
  commissionType: text("commission_type").default("percentage").notNull(),
  commissionValue: numeric("commission_value", { precision: 10, scale: 2 }).default("0").notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => ({ companyIdx: index("employees_company_idx").on(table.companyId) }));

export const employeeLocations = pgTable("employee_locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").default(false).notNull(),
  ...timestamps,
}, (table) => ({
  empLocIdx: uniqueIndex("employee_locations_emp_loc_idx").on(table.employeeId, table.locationId),
}));

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  userId: uuid("user_id").references(() => users.id),
  name: text("name").notNull(),
  photoUrl: text("photo_url"),
  phone: text("phone").notNull(),
  email: text("email"),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => ({ userCompanyIdx: uniqueIndex("clients_company_user_idx").on(table.companyId, table.userId), companyIdx: index("clients_company_idx").on(table.companyId), phoneIdx: index("clients_phone_idx").on(table.phone) }));

export const serviceCategories = pgTable("service_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  ...timestamps,
}, (table) => ({ companyIdx: index("service_categories_company_idx").on(table.companyId) }));

export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  categoryId: uuid("category_id").references(() => serviceCategories.id),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  bufferMinutes: integer("buffer_minutes").default(0).notNull(),
  imageUrl: text("image_url"),
  deliveryMode: text("delivery_mode").default("IN_PERSON").notNull(),
  paymentType: text("payment_type").default("PAY_LATER").notNull(),
  depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  cancellationPolicy: text("cancellation_policy"),
  color: text("color"),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => ({ companyIdx: index("services_company_idx").on(table.companyId) }));

export const employeeServices = pgTable("employee_services", {
  employeeId: uuid("employee_id").notNull().references(() => employees.id),
  serviceId: uuid("service_id").notNull().references(() => services.id),
  commissionType: text("commission_type").default("percentage").notNull(),
  commissionValue: numeric("commission_value", { precision: 10, scale: 2 }).default("0").notNull(),
}, (table) => ({ pk: primaryKey({ columns: [table.employeeId, table.serviceId] }) }));

export const bookings = pgTable("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  locationId: uuid("location_id").notNull().references(() => locations.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  timezone: text("timezone").notNull(),
  status: text("status").default("confirmed").notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 10, scale: 2 }).default("0").notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  paymentStatus: text("payment_status").default("unpaid").notNull(),
  paymentType: text("payment_type").default("PAY_LATER").notNull(),
  source: text("source").default("PUBLIC_LINK").notNull(),
  notes: text("notes"),
  couponCode: text("coupon_code"),
  idempotencyKey: uuid("idempotency_key").notNull(),
  revision: integer("revision").default(1).notNull(),
  ...timestamps,
}, (t) => ({ userIdx: index("bookings_user_start_idx").on(t.userId, t.startsAt), companyIdx: index("bookings_company_start_idx").on(t.companyId, t.startsAt), requestIdx: uniqueIndex("bookings_user_request_idx").on(t.userId, t.idempotencyKey) }));

export const appointments = pgTable("appointments", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  bookingId: uuid("booking_id").references(() => bookings.id),
  source: text("source").default("ADMIN").notNull(),
  bufferMinutes: integer("buffer_minutes").default(0).notNull(),
  locationId: uuid("location_id").references(() => locations.id),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  employeeId: uuid("employee_id").notNull().references(() => employees.id),
  appointmentDate: date("appointment_date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  status: text("status").default("scheduled").notNull(),
  notes: text("notes"),
  // Forecast/scheduled amount, captured at creation. Never overwritten on finish —
  // realized revenue is derived from the payments table.
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelReason: text("cancel_reason"),
  ...timestamps,
}, (table) => ({
  companyDateIdx: index("appointments_company_date_idx").on(table.companyId, table.appointmentDate),
  employeeDateIdx: index("appointments_employee_date_idx").on(table.employeeId, table.appointmentDate),
  companyStatusIdx: index("appointments_company_status_idx").on(table.companyId, table.status),
}));

export const appointmentServices = pgTable("appointment_services", {
  appointmentId: uuid("appointment_id").notNull().references(() => appointments.id),
  serviceId: uuid("service_id").notNull().references(() => services.id),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  commissionType: text("commission_type").notNull(),
  commissionValue: numeric("commission_value", { precision: 10, scale: 2 }).default("0").notNull(),
  commissionAmount: numeric("commission_amount", { precision: 10, scale: 2 }).default("0").notNull(),
}, (table) => ({ pk: primaryKey({ columns: [table.appointmentId, table.serviceId] }) }));

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  appointmentId: uuid("appointment_id").notNull().references(() => appointments.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 10, scale: 2 }).default("0").notNull(),
  method: text("method").notNull(),
  status: text("status").default("paid").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  notes: text("notes"),
  idempotencyKey: text("idempotency_key"),
  ...timestamps,
}, (table) => ({ appointmentIdx: index("payments_appointment_idx").on(table.appointmentId) }));

export const employeeSchedules = pgTable("employee_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id").notNull().references(() => employees.id),
  locationId: uuid("location_id").references(() => locations.id),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  breakStart: time("break_start"),
  breakEnd: time("break_end"),
  active: boolean("active").default(true).notNull(),
});

export const scheduleBlocks = pgTable("schedule_blocks", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  employeeId: uuid("employee_id").references(() => employees.id),
  locationId: uuid("location_id").references(() => locations.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  reason: text("reason").notNull(),
  allDay: boolean("all_day").default(false).notNull(),
  ...timestamps,
});

export const appointmentHistory = pgTable("appointment_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  appointmentId: uuid("appointment_id").notNull().references(() => appointments.id),
  actorId: uuid("actor_id").references(() => users.id),
  action: text("action").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const companySettings = pgTable("company_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  key: text("key").notNull(),
  value: text("value"),
  ...timestamps,
}, (table) => ({ keyIdx: uniqueIndex("company_settings_key_idx").on(table.companyId, table.key) }));

// In-app notification centre feed. userId null => visible to the whole company.
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("notifications_company_idx").on(table.companyId, table.createdAt),
  userIdx: index("notifications_user_idx").on(table.userId),
}));

// Generic audit trail for sensitive actions (value changes, cancellations, team changes...).
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("audit_logs_company_idx").on(table.companyId, table.createdAt),
  entityIdx: index("audit_logs_entity_idx").on(table.entity, table.entityId),
}));

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, t => ({ companyIdx: index("products_company_idx").on(t.companyId) }));

export const bookingProducts = pgTable("booking_products", {
  bookingId: uuid("booking_id").notNull().references(() => bookings.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
}, t => ({ pk: primaryKey({ columns: [t.bookingId, t.productId] }) }));

export const coupons = pgTable("coupons", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  code: text("code").notNull(),
  type: text("type").notNull(),
  value: numeric("value", { precision: 10, scale: 2 }).notNull(),
  active: boolean("active").default(true).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  ...timestamps,
}, t => ({ codeIdx: uniqueIndex("coupons_company_code_idx").on(t.companyId, t.code) }));

export const notificationLogs = pgTable("notification_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id),
  event: text("event").notNull(),
  revision: integer("revision").notNull(),
  channel: text("channel").default("email").notNull(),
  status: text("status").default("pending").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
  ...timestamps,
}, t => ({ dedupeIdx: uniqueIndex("notification_logs_dedupe_idx").on(t.bookingId, t.event, t.revision, t.channel), queueIdx: index("notification_logs_queue_idx").on(t.status, t.dueAt) }));

export const bookingEvents = pgTable("booking_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  sessionId: uuid("session_id").notNull(),
  event: text("event").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => ({ funnelIdx: index("booking_events_company_event_idx").on(t.companyId, t.event, t.createdAt) }));

export const bookingWaitlist = pgTable("booking_waitlist", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  requestedDate: date("requested_date").notNull(),
  serviceIds: jsonb("service_ids").$type<string[]>().notNull(),
  status: text("status").default("waiting").notNull(),
  ...timestamps,
});
