import {
  boolean,
  date,
  decimal,
  index,
  int,
  json,
  mysqlTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const timestamps = {
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
};

export const companies = mysqlTable("companies", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  businessType: varchar("business_type", { length: 100 }),
  logoUrl: text("logo_url"),
  phone: varchar("phone", { length: 50 }),
  whatsapp: varchar("whatsapp", { length: 50 }),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  instagram: varchar("instagram", { length: 100 }),
  website: text("website"),
  timezone: varchar("timezone", { length: 50 }).default("America/Sao_Paulo").notNull(),
  currency: varchar("currency", { length: 10 }).default("BRL").notNull(),
  primaryColor: varchar("primary_color", { length: 20 }).default("#3b82f6").notNull(),
  secondaryColor: varchar("secondary_color", { length: 20 }).default("#18181b").notNull(),
  publicSlug: varchar("public_slug", { length: 120 }).unique(),
  publicEnabled: boolean("public_enabled").default(false).notNull(),
  publicDescription: text("public_description"),
  publicColor: varchar("public_color", { length: 20 }).default("#2563eb").notNull(),
  publicPhotos: json("public_photos").$type<string[]>().default([]).notNull(),
  publicPhone: boolean("public_phone").default(false).notNull(),
  publicInstagram: boolean("public_instagram").default(false).notNull(),
  cancellationHours: int("cancellation_hours").default(24).notNull(),
  allowProducts: boolean("allow_products").default(false).notNull(),
  onboarded: boolean("onboarded").default(false).notNull(),
  ...timestamps,
});

export const locations = mysqlTable("locations", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  openTime: time("open_time").default("08:00").notNull(),
  closeTime: time("close_time").default("19:00").notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => ({ companyIdx: index("locations_company_idx").on(table.companyId) }));

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).references(() => companies.id, { onDelete: "set null" }),
  phone: varchar("phone", { length: 50 }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).default("employee").notNull(),
  isSuperadmin: boolean("is_superadmin").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { mode: "date" }),
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url"),
  ...timestamps,
}, (table) => ({
  emailCompanyIdx: uniqueIndex("users_company_email_idx").on(table.companyId, table.email),
  emailIdx: index("users_email_idx").on(table.email),
}));

export const companyMemberships = mysqlTable("company_memberships", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).notNull(), // 'owner' | 'admin' | 'manager' | 'employee'
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => ({
  userCompanyIdx: uniqueIndex("company_memberships_user_company_idx").on(table.userId, table.companyId),
  companyIdx: index("company_memberships_company_idx").on(table.companyId),
}));

// One-time tokens for email verification and password reset.
// Only the SHA-256 hash of the token is stored; the raw token lives only in the e-mail link.
export const authTokens = mysqlTable("auth_tokens", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 50 }).notNull(), // 'email_verification' | 'password_reset'
  tokenHash: varchar("token_hash", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  consumedAt: timestamp("consumed_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => ({
  tokenHashIdx: uniqueIndex("auth_tokens_hash_idx").on(table.tokenHash),
  userKindIdx: index("auth_tokens_user_kind_idx").on(table.userId, table.kind),
}));

// Sliding-window counters for auth endpoints (login, register, password reset).
export const authRateLimits = mysqlTable("auth_rate_limits", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  bucket: varchar("bucket", { length: 255 }).notNull(), // e.g. "login:ip:1.2.3.4" or "login:email:foo@bar.com"
  hits: int("hits").default(0).notNull(),
  windowStartedAt: timestamp("window_started_at", { mode: "date" }).defaultNow().notNull(),
  blockedUntil: timestamp("blocked_until", { mode: "date" }),
}, (table) => ({
  bucketIdx: uniqueIndex("auth_rate_limits_bucket_idx").on(table.bucket),
}));

export const employees = mysqlTable("employees", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  locationId: varchar("location_id", { length: 36 }).references(() => locations.id, { onDelete: "set null" }),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  photoUrl: text("photo_url"),
  bannerUrl: text("banner_url"),
  phone: varchar("phone", { length: 50 }),
  jobTitle: varchar("job_title", { length: 100 }),
  commissionType: varchar("commission_type", { length: 50 }).default("percentage").notNull(),
  commissionValue: decimal("commission_value", { precision: 12, scale: 2 }).default("0").notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => ({ companyIdx: index("employees_company_idx").on(table.companyId) }));

export const employeeLocations = mysqlTable("employee_locations", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  employeeId: varchar("employee_id", { length: 36 }).notNull().references(() => employees.id, { onDelete: "cascade" }),
  locationId: varchar("location_id", { length: 36 }).notNull().references(() => locations.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").default(false).notNull(),
  ...timestamps,
}, (table) => ({
  empLocIdx: uniqueIndex("employee_locations_emp_loc_idx").on(table.employeeId, table.locationId),
}));

export const clients = mysqlTable("clients", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  photoUrl: text("photo_url"),
  phone: varchar("phone", { length: 50 }).notNull(),
  email: varchar("email", { length: 255 }),
  notes: text("notes"),
  internalNotes: text("internal_notes"),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => ({
  userCompanyIdx: uniqueIndex("clients_company_user_idx").on(table.companyId, table.userId),
  companyIdx: index("clients_company_idx").on(table.companyId),
  phoneIdx: index("clients_phone_idx").on(table.phone),
}));

export const serviceCategories = mysqlTable("service_categories", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  ...timestamps,
}, (table) => ({ companyIdx: index("service_categories_company_idx").on(table.companyId) }));

export const services = mysqlTable("services", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  categoryId: varchar("category_id", { length: 36 }).references(() => serviceCategories.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  durationMinutes: int("duration_minutes").notNull(),
  bufferMinutes: int("buffer_minutes").default(0).notNull(),
  imageUrl: text("image_url"),
  deliveryMode: varchar("delivery_mode", { length: 50 }).default("IN_PERSON").notNull(),
  paymentType: varchar("payment_type", { length: 50 }).default("PAY_LATER").notNull(),
  depositAmount: decimal("deposit_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  cancellationPolicy: text("cancellation_policy"),
  color: varchar("color", { length: 50 }),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => ({ companyIdx: index("services_company_idx").on(table.companyId) }));

export const employeeServices = mysqlTable("employee_services", {
  employeeId: varchar("employee_id", { length: 36 }).notNull().references(() => employees.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id", { length: 36 }).notNull().references(() => services.id, { onDelete: "cascade" }),
  commissionType: varchar("commission_type", { length: 50 }).default("percentage").notNull(),
  commissionValue: decimal("commission_value", { precision: 12, scale: 2 }).default("0").notNull(),
}, (table) => ({ pk: primaryKey({ columns: [table.employeeId, table.serviceId] }) }));

export const bookings = mysqlTable("bookings", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  locationId: varchar("location_id", { length: 36 }).notNull().references(() => locations.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: varchar("client_id", { length: 36 }).notNull().references(() => clients.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { mode: "date" }).notNull(),
  endsAt: timestamp("ends_at", { mode: "date" }).notNull(),
  timezone: varchar("timezone", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).default("confirmed").notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0").notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  paymentStatus: varchar("payment_status", { length: 50 }).default("unpaid").notNull(),
  paymentType: varchar("payment_type", { length: 50 }).default("PAY_LATER").notNull(),
  intendedPaymentMethod: varchar("intended_payment_method", { length: 50 }),
  source: varchar("source", { length: 50 }).default("PUBLIC_LINK").notNull(),
  notes: text("notes"),
  couponCode: varchar("coupon_code", { length: 50 }),
  idempotencyKey: varchar("idempotency_key", { length: 36 }).notNull(),
  revision: int("revision").default(1).notNull(),
  ...timestamps,
}, (t) => ({
  userIdx: index("bookings_user_start_idx").on(t.userId, t.startsAt),
  companyIdx: index("bookings_company_start_idx").on(t.companyId, t.startsAt),
  requestIdx: uniqueIndex("bookings_user_request_idx").on(t.userId, t.idempotencyKey),
}));

export const appointments = mysqlTable("appointments", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  bookingId: varchar("booking_id", { length: 36 }).references(() => bookings.id, { onDelete: "set null" }),
  source: varchar("source", { length: 50 }).default("ADMIN").notNull(),
  bufferMinutes: int("buffer_minutes").default(0).notNull(),
  locationId: varchar("location_id", { length: 36 }).references(() => locations.id, { onDelete: "set null" }),
  clientId: varchar("client_id", { length: 36 }).notNull().references(() => clients.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id", { length: 36 }).notNull().references(() => employees.id, { onDelete: "cascade" }),
  appointmentDate: date("appointment_date", { mode: "string" }).notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  status: varchar("status", { length: 50 }).default("scheduled").notNull(),
  notes: text("notes"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  cancelledAt: timestamp("cancelled_at", { mode: "date" }),
  cancelReason: text("cancel_reason"),
  ...timestamps,
}, (table) => ({
  companyDateIdx: index("appointments_company_date_idx").on(table.companyId, table.appointmentDate),
  employeeDateIdx: index("appointments_employee_date_idx").on(table.employeeId, table.appointmentDate),
  companyStatusIdx: index("appointments_company_status_idx").on(table.companyId, table.status),
}));

export const appointmentServices = mysqlTable("appointment_services", {
  appointmentId: varchar("appointment_id", { length: 36 }).notNull().references(() => appointments.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id", { length: 36 }).notNull().references(() => services.id, { onDelete: "cascade" }),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  durationMinutes: int("duration_minutes").notNull(),
  commissionType: varchar("commission_type", { length: 50 }).notNull(),
  commissionValue: decimal("commission_value", { precision: 12, scale: 2 }).default("0").notNull(),
  commissionAmount: decimal("commission_amount", { precision: 12, scale: 2 }).default("0").notNull(),
}, (table) => ({ pk: primaryKey({ columns: [table.appointmentId, table.serviceId] }) }));

export const payments = mysqlTable("payments", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  appointmentId: varchar("appointment_id", { length: 36 }).notNull().references(() => appointments.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0").notNull(),
  method: varchar("method", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).default("paid").notNull(),
  paidAt: timestamp("paid_at", { mode: "date" }),
  notes: text("notes"),
  idempotencyKey: varchar("idempotency_key", { length: 120 }),
  ...timestamps,
}, (table) => ({ appointmentIdx: index("payments_appointment_idx").on(table.appointmentId) }));

export const employeeSchedules = mysqlTable("employee_schedules", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  employeeId: varchar("employee_id", { length: 36 }).notNull().references(() => employees.id, { onDelete: "cascade" }),
  locationId: varchar("location_id", { length: 36 }).references(() => locations.id, { onDelete: "set null" }),
  dayOfWeek: int("day_of_week").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  breakStart: time("break_start"),
  breakEnd: time("break_end"),
  active: boolean("active").default(true).notNull(),
});

export const scheduleBlocks = mysqlTable("schedule_blocks", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id", { length: 36 }).references(() => employees.id, { onDelete: "set null" }),
  locationId: varchar("location_id", { length: 36 }).references(() => locations.id, { onDelete: "set null" }),
  startsAt: timestamp("starts_at", { mode: "date" }).notNull(),
  endsAt: timestamp("ends_at", { mode: "date" }).notNull(),
  reason: text("reason").notNull(),
  allDay: boolean("all_day").default(false).notNull(),
  ...timestamps,
});

export const appointmentHistory = mysqlTable("appointment_history", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  appointmentId: varchar("appointment_id", { length: 36 }).notNull().references(() => appointments.id, { onDelete: "cascade" }),
  actorId: varchar("actor_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 50 }).notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const companySettings = mysqlTable("company_settings", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 100 }).notNull(),
  value: text("value"),
  ...timestamps,
}, (table) => ({ keyIdx: uniqueIndex("company_settings_key_idx").on(table.companyId, table.key) }));

// In-app notification centre feed. userId null => visible to the whole company.
export const notifications = mysqlTable("notifications", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: varchar("entity_id", { length: 36 }),
  readAt: timestamp("read_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("notifications_company_idx").on(table.companyId, table.createdAt),
  userIdx: index("notifications_user_idx").on(table.userId),
}));

// Generic audit trail for sensitive actions (value changes, cancellations, team changes...).
export const auditLogs = mysqlTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 50 }).notNull(),
  entity: varchar("entity", { length: 50 }).notNull(),
  entityId: varchar("entity_id", { length: 36 }),
  metadata: json("metadata"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("audit_logs_company_idx").on(table.companyId, table.createdAt),
  entityIdx: index("audit_logs_entity_idx").on(table.entity, table.entityId),
}));

export const products = mysqlTable("products", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, t => ({ companyIdx: index("products_company_idx").on(t.companyId) }));

export const bookingProducts = mysqlTable("booking_products", {
  bookingId: varchar("booking_id", { length: 36 }).notNull().references(() => bookings.id, { onDelete: "cascade" }),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
}, t => ({ pk: primaryKey({ columns: [t.bookingId, t.productId] }) }));

export const coupons = mysqlTable("coupons", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 50 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  value: decimal("value", { precision: 12, scale: 2 }).notNull(),
  active: boolean("active").default(true).notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }),
  ...timestamps,
}, t => ({ codeIdx: uniqueIndex("coupons_company_code_idx").on(t.companyId, t.code) }));

export const notificationLogs = mysqlTable("notification_logs", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  bookingId: varchar("booking_id", { length: 36 }).notNull().references(() => bookings.id, { onDelete: "cascade" }),
  event: varchar("event", { length: 50 }).notNull(),
  revision: int("revision").notNull(),
  channel: varchar("channel", { length: 50 }).default("email").notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  dueAt: timestamp("due_at", { mode: "date" }).defaultNow().notNull(),
  sentAt: timestamp("sent_at", { mode: "date" }),
  attempts: int("attempts").default(0).notNull(),
  lastError: text("last_error"),
  ...timestamps,
}, t => ({
  dedupeIdx: uniqueIndex("notification_logs_dedupe_idx").on(t.bookingId, t.event, t.revision, t.channel),
  queueIdx: index("notification_logs_queue_idx").on(t.status, t.dueAt),
}));

export const bookingEvents = mysqlTable("booking_events", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  sessionId: varchar("session_id", { length: 36 }).notNull(),
  event: varchar("event", { length: 50 }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, t => ({ funnelIdx: index("booking_events_company_event_idx").on(t.companyId, t.event, t.createdAt) }));

export const bookingWaitlist = mysqlTable("booking_waitlist", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  requestedDate: date("requested_date", { mode: "string" }).notNull(),
  locationId: varchar("location_id", { length: 36 }).references(() => locations.id, { onDelete: "set null" }),
  employeeId: varchar("employee_id", { length: 36 }).references(() => employees.id, { onDelete: "set null" }),
  period: varchar("period", { length: 50 }).default("any").notNull(),
  serviceIds: json("service_ids").$type<string[]>().notNull(),
  status: varchar("status", { length: 50 }).default("waiting").notNull(),
  ...timestamps,
});

export const saasPlans = mysqlTable("saas_plans", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: varchar("slug", { length: 50 }).notNull().unique(), // 'essencial' | 'profissional' | 'equipe' | 'negocio' | 'empresa' | 'enterprise'
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull(),
  monthlyPrice: decimal("monthly_price", { precision: 12, scale: 2 }).notNull(),
  annualPrice: decimal("annual_price", { precision: 12, scale: 2 }).notNull(),
  employeeLimit: int("employee_limit").notNull(), // 2, 5, 10, 20, 50, 100
  badge: varchar("badge", { length: 50 }),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
  gatewayPlanId: varchar("gateway_plan_id", { length: 100 }),
  ...timestamps,
}, (table) => ({
  slugIdx: uniqueIndex("saas_plans_slug_idx").on(table.slug),
  activeIdx: index("saas_plans_active_idx").on(table.isActive),
}));

export const saasCoupons = mysqlTable("saas_coupons", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  discountType: varchar("discount_type", { length: 50 }).notNull(), // 'PERCENTAGE' | 'FIXED_AMOUNT'
  discountValue: decimal("discount_value", { precision: 12, scale: 2 }).notNull(),
  maxDiscountAmount: decimal("max_discount_amount", { precision: 12, scale: 2 }),
  appliesTo: varchar("applies_to", { length: 50 }).default("ALL_PLANS").notNull(), // 'ALL_PLANS' | 'SPECIFIC_PLANS'
  startsAt: timestamp("starts_at", { mode: "date" }),
  expiresAt: timestamp("expires_at", { mode: "date" }),
  maxRedemptions: int("max_redemptions"),
  maxRedemptionsPerBusiness: int("max_redemptions_per_business").default(1).notNull(),
  durationType: varchar("duration_type", { length: 50 }).default("ONCE").notNull(), // 'ONCE' | 'LIMITED_CYCLES' | 'FOREVER'
  durationCycles: int("duration_cycles").default(1),
  minimumPlanAmount: decimal("minimum_plan_amount", { precision: 12, scale: 2 }),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
}, (table) => ({
  codeIdx: uniqueIndex("saas_coupons_code_idx").on(table.code),
  activeIdx: index("saas_coupons_active_idx").on(table.isActive),
  expiresIdx: index("saas_coupons_expires_idx").on(table.expiresAt),
}));

export const saasCouponPlans = mysqlTable("saas_coupon_plans", {
  couponId: varchar("coupon_id", { length: 36 }).notNull().references(() => saasCoupons.id, { onDelete: "cascade" }),
  planId: varchar("plan_id", { length: 36 }).notNull().references(() => saasPlans.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.couponId, table.planId] }),
}));

export const subscriptions = mysqlTable("subscriptions", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  plan: varchar("plan", { length: 50 }).default("trial").notNull(), // 'trial' | 'essencial' | 'profissional' | 'equipe' | 'negocio' | 'empresa' | 'enterprise' | 'pro_monthly' | 'pro_yearly'
  planId: varchar("plan_id", { length: 36 }).references(() => saasPlans.id, { onDelete: "set null" }),
  status: varchar("status", { length: 50 }).default("trialing").notNull(), // 'trialing' | 'pending' | 'active' | 'past_due' | 'payment_failed' | 'cancelled' | 'expired' | 'suspended'
  billingInterval: varchar("billing_interval", { length: 20 }).default("monthly").notNull(), // 'monthly' | 'yearly'
  amount: decimal("amount", { precision: 12, scale: 2 }),
  priceSnapshot: decimal("price_snapshot", { precision: 12, scale: 2 }),
  discountSnapshot: decimal("discount_snapshot", { precision: 12, scale: 2 }).default("0.00"),
  finalPriceSnapshot: decimal("final_price_snapshot", { precision: 12, scale: 2 }),
  appliedCouponId: varchar("applied_coupon_id", { length: 36 }).references(() => saasCoupons.id, { onDelete: "set null" }),
  paymentMethod: varchar("payment_method", { length: 50 }).default("pix"), // 'pix' | 'card' | 'manual'
  gateway: varchar("gateway", { length: 50 }).default("mercadopago").notNull(), // 'mercadopago' | 'manual' | 'simulated'
  gatewayCustomerId: varchar("gateway_customer_id", { length: 100 }),
  gatewaySubscriptionId: varchar("gateway_subscription_id", { length: 100 }),
  gatewayPaymentId: varchar("gateway_payment_id", { length: 100 }),
  trialStartedAt: timestamp("trial_started_at", { mode: "date" }),
  trialEndsAt: timestamp("trial_ends_at", { mode: "date" }).notNull(),
  currentPeriodStart: timestamp("current_period_start", { mode: "date" }),
  currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
  nextPaymentAt: timestamp("next_payment_at", { mode: "date" }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  cancelledAt: timestamp("cancelled_at", { mode: "date" }),
  mercadoPagoSubscriptionId: varchar("mercado_pago_subscription_id", { length: 100 }),
  mercadoPagoPayerId: varchar("mercado_pago_payer_id", { length: 100 }),
  ...timestamps,
}, (table) => ({
  companyIdx: uniqueIndex("subscriptions_company_idx").on(table.companyId),
  statusIdx: index("subscriptions_status_idx").on(table.status),
  planIdx: index("subscriptions_plan_idx").on(table.plan),
  trialEndsIdx: index("subscriptions_trial_ends_idx").on(table.trialEndsAt),
}));

export const subscriptionInvoices = mysqlTable("subscription_invoices", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  subscriptionId: varchar("subscription_id", { length: 36 }).notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  number: varchar("number", { length: 50 }),
  planSlug: varchar("plan_slug", { length: 50 }),
  billingInterval: varchar("billing_interval", { length: 20 }).default("monthly").notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  total: decimal("total", { precision: 12, scale: 2 }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("BRL").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).default("pix").notNull(), // 'pix' | 'card' | 'manual'
  status: varchar("status", { length: 50 }).default("paid").notNull(), // 'paid' | 'pending' | 'failed' | 'cancelled' | 'refunded' | 'expired'
  dueAt: timestamp("due_at", { mode: "date" }),
  paidAt: timestamp("paid_at", { mode: "date" }),
  failedAt: timestamp("failed_at", { mode: "date" }),
  pixQrCode: text("pix_qr_code"),
  pixQrCodeBase64: text("pix_qr_code_base64"),
  pixCopiaECola: text("pix_copia_e_cola"),
  pixExpiresAt: timestamp("pix_expires_at", { mode: "date" }),
  mercadoPagoPaymentId: varchar("mercado_pago_payment_id", { length: 100 }),
  gatewayStatus: varchar("gateway_status", { length: 50 }),
  gatewayStatusDetail: varchar("gateway_status_detail", { length: 100 }),
  invoiceUrl: text("invoice_url"),
  metadata: json("metadata"),
  ...timestamps,
}, (table) => ({
  companyIdx: index("subscription_invoices_company_idx").on(table.companyId),
  statusIdx: index("subscription_invoices_status_idx").on(table.status),
  paymentIdIdx: index("subscription_invoices_mp_idx").on(table.mercadoPagoPaymentId),
}));

export const saasCouponRedemptions = mysqlTable("saas_coupon_redemptions", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  couponId: varchar("coupon_id", { length: 36 }).notNull().references(() => saasCoupons.id, { onDelete: "cascade" }),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  subscriptionId: varchar("subscription_id", { length: 36 }).references(() => subscriptions.id, { onDelete: "set null" }),
  invoiceId: varchar("invoice_id", { length: 36 }).references(() => subscriptionInvoices.id, { onDelete: "set null" }),
  originalAmount: decimal("original_amount", { precision: 12, scale: 2 }).notNull(),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).notNull(),
  finalAmount: decimal("final_amount", { precision: 12, scale: 2 }).notNull(),
  cycleNumber: int("cycle_number").default(1).notNull(),
  status: varchar("status", { length: 50 }).default("pending").notNull(), // 'pending' | 'confirmed' | 'cancelled'
  redeemedAt: timestamp("redeemed_at", { mode: "date" }),
  ...timestamps,
}, (table) => ({
  couponIdx: index("saas_coupon_redemptions_coupon_idx").on(table.couponId),
  companyIdx: index("saas_coupon_redemptions_company_idx").on(table.companyId),
  subscriptionIdx: index("saas_coupon_redemptions_sub_idx").on(table.subscriptionId),
  statusIdx: index("saas_coupon_redemptions_status_idx").on(table.status),
}));

export const paymentWebhookEvents = mysqlTable("payment_webhook_events", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  gateway: varchar("gateway", { length: 50 }).notNull(), // 'mercadopago' | 'other'
  eventId: varchar("event_id", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  payload: json("payload").notNull(),
  status: varchar("status", { length: 50 }).default("processed").notNull(), // 'processed' | 'failed' | 'ignored'
  processedAt: timestamp("processed_at", { mode: "date" }),
  failedAt: timestamp("failed_at", { mode: "date" }),
  errorMessage: text("error_message"),
  ...timestamps,
}, (table) => ({
  eventIdIdx: uniqueIndex("payment_webhook_events_event_id_idx").on(table.gateway, table.eventId),
}));

export const reviews = mysqlTable("reviews", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  appointmentId: varchar("appointment_id", { length: 36 }).notNull().references(() => appointments.id, { onDelete: "cascade" }),
  clientId: varchar("client_id", { length: 36 }).notNull().references(() => clients.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id", { length: 36 }).notNull().references(() => employees.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id", { length: 36 }).references(() => services.id, { onDelete: "set null" }),
  rating: int("rating").notNull(), // 1 to 5
  comment: text("comment"),
  status: varchar("status", { length: 50 }).default("approved").notNull(), // 'pending' | 'approved' | 'hidden'
  ...timestamps,
}, (table) => ({
  appointmentIdx: uniqueIndex("reviews_appointment_idx").on(table.appointmentId),
  companyIdx: index("reviews_company_idx").on(table.companyId),
  employeeIdx: index("reviews_employee_idx").on(table.employeeId),
}));

// ========================================================
// CUSTOMER MEMBERSHIP / PLANOS MENSAIS RECORRENTES (MULTINICHO)
// Separated from SaaS subscriptions (Reservei)
// ========================================================

export const membershipPlans = mysqlTable("membership_plans", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(), // Mensalidade
  billingPeriod: varchar("billing_period", { length: 50 }).default("monthly").notNull(),
  frequencyType: varchar("frequency_type", { length: 50 }).default("WEEKLY_CALENDAR_BASED").notNull(), // 'WEEKLY_CALENDAR_BASED' | 'FIXED_MONTHLY_QUOTA' | 'CUSTOM_WEEKLY_FREQUENCY'
  sessionsPerPeriod: int("sessions_per_period").default(4).notNull(), // Used when FIXED_MONTHLY_QUOTA
  weeklyFrequency: int("weekly_frequency").default(1).notNull(), // e.g. 1 = 1x/semana, 2 = 2x/semana
  allowReschedule: boolean("allow_reschedule").default(true).notNull(),
  rescheduleHoursNotice: int("reschedule_hours_notice").default(2).notNull(),
  allowCarryOver: boolean("allow_carry_over").default(false).notNull(),
  noShowConsumesSession: boolean("no_show_consumes_session").default(true).notNull(),
  lateCancelConsumesSession: boolean("late_cancel_consumes_session").default(true).notNull(),
  badgeColor: varchar("badge_color", { length: 50 }).default("#3b82f6"),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => ({
  companyIdx: index("membership_plans_company_idx").on(table.companyId),
}));

export const membershipPlanServices = mysqlTable("membership_plan_services", {
  membershipPlanId: varchar("membership_plan_id", { length: 36 }).notNull().references(() => membershipPlans.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id", { length: 36 }).notNull().references(() => services.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.membershipPlanId, table.serviceId] }),
}));

export const membershipPlanEmployees = mysqlTable("membership_plan_employees", {
  membershipPlanId: varchar("membership_plan_id", { length: 36 }).notNull().references(() => membershipPlans.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id", { length: 36 }).notNull().references(() => employees.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.membershipPlanId, table.employeeId] }),
}));

export const customerMemberships = mysqlTable("customer_memberships", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  clientId: varchar("client_id", { length: 36 }).notNull().references(() => clients.id, { onDelete: "cascade" }),
  membershipPlanId: varchar("membership_plan_id", { length: 36 }).notNull().references(() => membershipPlans.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { mode: "date" }).notNull(),
  endsAt: timestamp("ends_at", { mode: "date" }),
  status: varchar("status", { length: 50 }).default("active").notNull(), // 'active' | 'paused' | 'cancelled' | 'expired' | 'pending'
  preferredProfessionalId: varchar("preferred_professional_id", { length: 36 }).references(() => employees.id, { onDelete: "set null" }),
  preferredWeekdays: json("preferred_weekdays").$type<number[]>().default([]).notNull(), // e.g. [4] for Thursday, [2, 4] for Tue/Thu
  preferredTime: time("preferred_time"),
  monthlyPriceSnapshot: decimal("monthly_price_snapshot", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  ...timestamps,
}, (table) => ({
  clientIdx: index("customer_memberships_client_idx").on(table.clientId),
  companyIdx: index("customer_memberships_company_idx").on(table.companyId),
  planIdx: index("customer_memberships_plan_idx").on(table.membershipPlanId),
  statusIdx: index("customer_memberships_status_idx").on(table.companyId, table.status),
}));

export const membershipPeriods = mysqlTable("membership_periods", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  customerMembershipId: varchar("customer_membership_id", { length: 36 }).notNull().references(() => customerMemberships.id, { onDelete: "cascade" }),
  periodStart: date("period_start", { mode: "string" }).notNull(), // YYYY-MM-01
  periodEnd: date("period_end", { mode: "string" }).notNull(), // YYYY-MM-LastDay
  sessionAllowance: int("session_allowance").notNull(), // 4 or 5 or custom
  sessionsBooked: int("sessions_booked").default(0).notNull(),
  sessionsUsed: int("sessions_used").default(0).notNull(),
  paymentStatus: varchar("payment_status", { length: 50 }).default("pending").notNull(), // 'pending' | 'paid' | 'waived'
  paidAt: timestamp("paid_at", { mode: "date" }),
  paymentMethod: varchar("payment_method", { length: 50 }), // 'pix' | 'cash' | 'card' | 'other'
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).default("active").notNull(), // 'active' | 'closed' | 'cancelled'
  ...timestamps,
}, (table) => ({
  membershipIdx: index("membership_periods_membership_idx").on(table.customerMembershipId),
  periodRangeIdx: index("membership_periods_range_idx").on(table.companyId, table.periodStart, table.periodEnd),
  paymentStatusIdx: index("membership_periods_pay_status_idx").on(table.companyId, table.paymentStatus),
}));

export const bookingMembershipUsage = mysqlTable("booking_membership_usage", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  appointmentId: varchar("appointment_id", { length: 36 }).notNull().references(() => appointments.id, { onDelete: "cascade" }),
  customerMembershipId: varchar("customer_membership_id", { length: 36 }).notNull().references(() => customerMemberships.id, { onDelete: "cascade" }),
  membershipPeriodId: varchar("membership_period_id", { length: 36 }).notNull().references(() => membershipPeriods.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id", { length: 36 }).notNull().references(() => services.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).default("booked").notNull(), // 'booked' | 'used' | 'cancelled_refunded' | 'cancelled_forfeited' | 'no_show_forfeited'
  ...timestamps,
}, (table) => ({
  appointmentIdx: uniqueIndex("booking_membership_usage_appointment_idx").on(table.appointmentId),
  periodIdx: index("booking_membership_usage_period_idx").on(table.membershipPeriodId),
  membershipIdx: index("booking_membership_usage_membership_idx").on(table.customerMembershipId),
}));

export const customerMembershipPayments = mysqlTable("customer_membership_payments", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: varchar("company_id", { length: 36 }).notNull().references(() => companies.id, { onDelete: "cascade" }),
  customerMembershipId: varchar("customer_membership_id", { length: 36 }).notNull().references(() => customerMemberships.id, { onDelete: "cascade" }),
  membershipPeriodId: varchar("membership_period_id", { length: 36 }).notNull().references(() => membershipPeriods.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  method: varchar("method", { length: 50 }).notNull(), // 'pix' | 'cash' | 'debit' | 'credit' | 'other'
  status: varchar("status", { length: 50 }).default("paid").notNull(),
  paidAt: timestamp("paid_at", { mode: "date" }).defaultNow().notNull(),
  notes: text("notes"),
  ...timestamps,
}, (table) => ({
  companyIdx: index("cust_membership_payments_company_idx").on(table.companyId),
  periodIdx: index("cust_membership_payments_period_idx").on(table.membershipPeriodId),
}));

export const customerCredentials = mysqlTable("customer_credentials", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  phoneNormalized: varchar("phone_normalized", { length: 20 }).notNull(),
  pinHash: varchar("pin_hash", { length: 255 }).notNull(),
  pinCreatedAt: timestamp("pin_created_at", { mode: "date" }).defaultNow().notNull(),
  pinUpdatedAt: timestamp("pin_updated_at", { mode: "date" }).defaultNow().notNull(),
  failedAttempts: int("failed_attempts").default(0).notNull(),
  lockedUntil: timestamp("locked_until", { mode: "date" }),
  lastLoginAt: timestamp("last_login_at", { mode: "date" }),
  ...timestamps,
}, (table) => ({
  userIdIdx: uniqueIndex("customer_credentials_user_id_idx").on(table.userId),
  phoneNormalizedIdx: uniqueIndex("customer_credentials_phone_normalized_idx").on(table.phoneNormalized),
}));

export const customerAccessLogs = mysqlTable("customer_access_logs", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  phoneNormalized: varchar("phone_normalized", { length: 20 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  ipAddress: varchar("ip_address", { length: 64 }),
  userAgent: text("user_agent"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => ({
  phoneIdx: index("customer_access_logs_phone_idx").on(table.phoneNormalized),
  userIdIdx: index("customer_access_logs_user_id_idx").on(table.userId),
  actionIdx: index("customer_access_logs_action_idx").on(table.action),
  createdIdx: index("customer_access_logs_created_idx").on(table.createdAt),
}));

