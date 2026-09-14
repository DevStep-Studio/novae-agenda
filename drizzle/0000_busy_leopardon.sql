CREATE TABLE `appointment_history` (
	`id` varchar(36) NOT NULL,
	`appointment_id` varchar(36) NOT NULL,
	`actor_id` varchar(36),
	`action` varchar(50) NOT NULL,
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `appointment_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `appointment_services` (
	`appointment_id` varchar(36) NOT NULL,
	`service_id` varchar(36) NOT NULL,
	`price` decimal(12,2) NOT NULL,
	`duration_minutes` int NOT NULL,
	`commission_type` varchar(50) NOT NULL,
	`commission_value` decimal(12,2) NOT NULL DEFAULT '0',
	`commission_amount` decimal(12,2) NOT NULL DEFAULT '0',
	CONSTRAINT `appointment_services_appointment_id_service_id_pk` PRIMARY KEY(`appointment_id`,`service_id`)
);
--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`booking_id` varchar(36),
	`source` varchar(50) NOT NULL DEFAULT 'ADMIN',
	`buffer_minutes` int NOT NULL DEFAULT 0,
	`location_id` varchar(36),
	`client_id` varchar(36) NOT NULL,
	`employee_id` varchar(36) NOT NULL,
	`appointment_date` date NOT NULL,
	`start_time` time NOT NULL,
	`end_time` time NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'scheduled',
	`notes` text,
	`total` decimal(12,2) NOT NULL,
	`cancelled_at` timestamp,
	`cancel_reason` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`action` varchar(50) NOT NULL,
	`entity` varchar(50) NOT NULL,
	`entity_id` varchar(36),
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_rate_limits` (
	`id` varchar(36) NOT NULL,
	`bucket` varchar(255) NOT NULL,
	`hits` int NOT NULL DEFAULT 0,
	`window_started_at` timestamp NOT NULL DEFAULT (now()),
	`blocked_until` timestamp,
	CONSTRAINT `auth_rate_limits_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_rate_limits_bucket_idx` UNIQUE(`bucket`)
);
--> statement-breakpoint
CREATE TABLE `auth_tokens` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`kind` varchar(50) NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`consumed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_tokens_hash_idx` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `booking_events` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`event` varchar(50) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_membership_usage` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`appointment_id` varchar(36) NOT NULL,
	`customer_membership_id` varchar(36) NOT NULL,
	`membership_period_id` varchar(36) NOT NULL,
	`service_id` varchar(36) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'booked',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_membership_usage_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_membership_usage_appointment_idx` UNIQUE(`appointment_id`)
);
--> statement-breakpoint
CREATE TABLE `booking_products` (
	`booking_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`quantity` int NOT NULL,
	`unit_price` decimal(12,2) NOT NULL,
	CONSTRAINT `booking_products_booking_id_product_id_pk` PRIMARY KEY(`booking_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `booking_waitlist` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`requested_date` date NOT NULL,
	`location_id` varchar(36),
	`employee_id` varchar(36),
	`period` varchar(50) NOT NULL DEFAULT 'any',
	`service_ids` json NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'waiting',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_waitlist_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`location_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`client_id` varchar(36) NOT NULL,
	`starts_at` timestamp NOT NULL,
	`ends_at` timestamp NOT NULL,
	`timezone` varchar(50) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'confirmed',
	`subtotal` decimal(12,2) NOT NULL,
	`discount` decimal(12,2) NOT NULL DEFAULT '0',
	`total` decimal(12,2) NOT NULL,
	`payment_status` varchar(50) NOT NULL DEFAULT 'unpaid',
	`payment_type` varchar(50) NOT NULL DEFAULT 'PAY_LATER',
	`intended_payment_method` varchar(50),
	`source` varchar(50) NOT NULL DEFAULT 'PUBLIC_LINK',
	`notes` text,
	`coupon_code` varchar(50),
	`idempotency_key` varchar(36) NOT NULL,
	`revision` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookings_user_request_idx` UNIQUE(`user_id`,`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`name` varchar(255) NOT NULL,
	`photo_url` text,
	`phone` varchar(50) NOT NULL,
	`email` varchar(255),
	`notes` text,
	`internal_notes` text,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `clients_company_user_idx` UNIQUE(`company_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`business_type` varchar(100),
	`logo_url` text,
	`phone` varchar(50),
	`whatsapp` varchar(50),
	`email` varchar(255),
	`address` text,
	`instagram` varchar(100),
	`website` text,
	`timezone` varchar(50) NOT NULL DEFAULT 'America/Sao_Paulo',
	`currency` varchar(10) NOT NULL DEFAULT 'BRL',
	`primary_color` varchar(20) NOT NULL DEFAULT '#3b82f6',
	`secondary_color` varchar(20) NOT NULL DEFAULT '#18181b',
	`public_slug` varchar(120),
	`public_enabled` boolean NOT NULL DEFAULT false,
	`public_description` text,
	`public_color` varchar(20) NOT NULL DEFAULT '#2563eb',
	`public_photos` json NOT NULL DEFAULT ('[]'),
	`public_phone` boolean NOT NULL DEFAULT false,
	`public_instagram` boolean NOT NULL DEFAULT false,
	`cancellation_hours` int NOT NULL DEFAULT 24,
	`allow_products` boolean NOT NULL DEFAULT false,
	`onboarded` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `companies_id` PRIMARY KEY(`id`),
	CONSTRAINT `companies_public_slug_unique` UNIQUE(`public_slug`)
);
--> statement-breakpoint
CREATE TABLE `company_memberships` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`role` varchar(50) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `company_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `company_memberships_user_company_idx` UNIQUE(`user_id`,`company_id`)
);
--> statement-breakpoint
CREATE TABLE `company_settings` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `company_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `company_settings_key_idx` UNIQUE(`company_id`,`key`)
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`code` varchar(50) NOT NULL,
	`type` varchar(50) NOT NULL,
	`value` decimal(12,2) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`expires_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `coupons_company_code_idx` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `customer_membership_payments` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`customer_membership_id` varchar(36) NOT NULL,
	`membership_period_id` varchar(36) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`method` varchar(50) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'paid',
	`paid_at` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_membership_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer_memberships` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`client_id` varchar(36) NOT NULL,
	`membership_plan_id` varchar(36) NOT NULL,
	`starts_at` timestamp NOT NULL,
	`ends_at` timestamp,
	`status` varchar(50) NOT NULL DEFAULT 'active',
	`preferred_professional_id` varchar(36),
	`preferred_weekdays` json NOT NULL DEFAULT ('[]'),
	`preferred_time` time,
	`monthly_price_snapshot` decimal(12,2) NOT NULL,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee_locations` (
	`id` varchar(36) NOT NULL,
	`employee_id` varchar(36) NOT NULL,
	`location_id` varchar(36) NOT NULL,
	`is_primary` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employee_locations_id` PRIMARY KEY(`id`),
	CONSTRAINT `employee_locations_emp_loc_idx` UNIQUE(`employee_id`,`location_id`)
);
--> statement-breakpoint
CREATE TABLE `employee_schedules` (
	`id` varchar(36) NOT NULL,
	`employee_id` varchar(36) NOT NULL,
	`location_id` varchar(36),
	`day_of_week` int NOT NULL,
	`start_time` time NOT NULL,
	`end_time` time NOT NULL,
	`break_start` time,
	`break_end` time,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `employee_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee_services` (
	`employee_id` varchar(36) NOT NULL,
	`service_id` varchar(36) NOT NULL,
	`commission_type` varchar(50) NOT NULL DEFAULT 'percentage',
	`commission_value` decimal(12,2) NOT NULL DEFAULT '0',
	CONSTRAINT `employee_services_employee_id_service_id_pk` PRIMARY KEY(`employee_id`,`service_id`)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`location_id` varchar(36),
	`user_id` varchar(36),
	`name` varchar(255) NOT NULL,
	`photo_url` text,
	`banner_url` text,
	`phone` varchar(50),
	`job_title` varchar(100),
	`commission_type` varchar(50) NOT NULL DEFAULT 'percentage',
	`commission_value` decimal(12,2) NOT NULL DEFAULT '0',
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employees_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text,
	`phone` varchar(50),
	`open_time` time NOT NULL DEFAULT '08:00',
	`close_time` time NOT NULL DEFAULT '19:00',
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `membership_periods` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`customer_membership_id` varchar(36) NOT NULL,
	`period_start` date NOT NULL,
	`period_end` date NOT NULL,
	`session_allowance` int NOT NULL,
	`sessions_booked` int NOT NULL DEFAULT 0,
	`sessions_used` int NOT NULL DEFAULT 0,
	`payment_status` varchar(50) NOT NULL DEFAULT 'pending',
	`paid_at` timestamp,
	`payment_method` varchar(50),
	`amount` decimal(12,2) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `membership_periods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `membership_plan_employees` (
	`membership_plan_id` varchar(36) NOT NULL,
	`employee_id` varchar(36) NOT NULL,
	CONSTRAINT `membership_plan_employees_membership_plan_id_employee_id_pk` PRIMARY KEY(`membership_plan_id`,`employee_id`)
);
--> statement-breakpoint
CREATE TABLE `membership_plan_services` (
	`membership_plan_id` varchar(36) NOT NULL,
	`service_id` varchar(36) NOT NULL,
	CONSTRAINT `membership_plan_services_membership_plan_id_service_id_pk` PRIMARY KEY(`membership_plan_id`,`service_id`)
);
--> statement-breakpoint
CREATE TABLE `membership_plans` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`image_url` text,
	`price` decimal(12,2) NOT NULL,
	`billing_period` varchar(50) NOT NULL DEFAULT 'monthly',
	`frequency_type` varchar(50) NOT NULL DEFAULT 'WEEKLY_CALENDAR_BASED',
	`sessions_per_period` int NOT NULL DEFAULT 4,
	`weekly_frequency` int NOT NULL DEFAULT 1,
	`allow_reschedule` boolean NOT NULL DEFAULT true,
	`reschedule_hours_notice` int NOT NULL DEFAULT 2,
	`allow_carry_over` boolean NOT NULL DEFAULT false,
	`no_show_consumes_session` boolean NOT NULL DEFAULT true,
	`late_cancel_consumes_session` boolean NOT NULL DEFAULT true,
	`badge_color` varchar(50) DEFAULT '#3b82f6',
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `membership_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_logs` (
	`id` varchar(36) NOT NULL,
	`booking_id` varchar(36) NOT NULL,
	`event` varchar(50) NOT NULL,
	`revision` int NOT NULL,
	`channel` varchar(50) NOT NULL DEFAULT 'email',
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`due_at` timestamp NOT NULL DEFAULT (now()),
	`sent_at` timestamp,
	`attempts` int NOT NULL DEFAULT 0,
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notification_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_logs_dedupe_idx` UNIQUE(`booking_id`,`event`,`revision`,`channel`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`type` varchar(50) NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text,
	`entity_type` varchar(50),
	`entity_id` varchar(36),
	`read_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_webhook_events` (
	`id` varchar(36) NOT NULL,
	`gateway` varchar(50) NOT NULL,
	`event_id` varchar(255) NOT NULL,
	`type` varchar(100) NOT NULL,
	`payload` json NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'processed',
	`processed_at` timestamp,
	`failed_at` timestamp,
	`error_message` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_webhook_events_event_id_idx` UNIQUE(`gateway`,`event_id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`appointment_id` varchar(36) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`discount` decimal(12,2) NOT NULL DEFAULT '0',
	`method` varchar(50) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'paid',
	`paid_at` timestamp,
	`notes` text,
	`idempotency_key` varchar(120),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`price` decimal(12,2) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`appointment_id` varchar(36) NOT NULL,
	`client_id` varchar(36) NOT NULL,
	`employee_id` varchar(36) NOT NULL,
	`service_id` varchar(36),
	`rating` int NOT NULL,
	`comment` text,
	`status` varchar(50) NOT NULL DEFAULT 'approved',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `reviews_appointment_idx` UNIQUE(`appointment_id`)
);
--> statement-breakpoint
CREATE TABLE `saas_coupon_plans` (
	`coupon_id` varchar(36) NOT NULL,
	`plan_id` varchar(36) NOT NULL,
	CONSTRAINT `saas_coupon_plans_coupon_id_plan_id_pk` PRIMARY KEY(`coupon_id`,`plan_id`)
);
--> statement-breakpoint
CREATE TABLE `saas_coupon_redemptions` (
	`id` varchar(36) NOT NULL,
	`coupon_id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`subscription_id` varchar(36),
	`invoice_id` varchar(36),
	`original_amount` decimal(12,2) NOT NULL,
	`discount_amount` decimal(12,2) NOT NULL,
	`final_amount` decimal(12,2) NOT NULL,
	`cycle_number` int NOT NULL DEFAULT 1,
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`redeemed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saas_coupon_redemptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saas_coupons` (
	`id` varchar(36) NOT NULL,
	`code` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`discount_type` varchar(50) NOT NULL,
	`discount_value` decimal(12,2) NOT NULL,
	`max_discount_amount` decimal(12,2),
	`applies_to` varchar(50) NOT NULL DEFAULT 'ALL_PLANS',
	`starts_at` timestamp,
	`expires_at` timestamp,
	`max_redemptions` int,
	`max_redemptions_per_business` int NOT NULL DEFAULT 1,
	`duration_type` varchar(50) NOT NULL DEFAULT 'ONCE',
	`duration_cycles` int DEFAULT 1,
	`minimum_plan_amount` decimal(12,2),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saas_coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `saas_coupons_code_unique` UNIQUE(`code`),
	CONSTRAINT `saas_coupons_code_idx` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `saas_plans` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text NOT NULL,
	`monthly_price` decimal(12,2) NOT NULL,
	`annual_price` decimal(12,2) NOT NULL,
	`employee_limit` int NOT NULL,
	`badge` varchar(50),
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`gateway_plan_id` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saas_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `saas_plans_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `saas_plans_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `schedule_blocks` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`employee_id` varchar(36),
	`location_id` varchar(36),
	`starts_at` timestamp NOT NULL,
	`ends_at` timestamp NOT NULL,
	`reason` text NOT NULL,
	`all_day` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `schedule_blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_categories` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `service_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`category_id` varchar(36),
	`name` varchar(255) NOT NULL,
	`description` text,
	`price` decimal(12,2) NOT NULL,
	`duration_minutes` int NOT NULL,
	`buffer_minutes` int NOT NULL DEFAULT 0,
	`image_url` text,
	`delivery_mode` varchar(50) NOT NULL DEFAULT 'IN_PERSON',
	`payment_type` varchar(50) NOT NULL DEFAULT 'PAY_LATER',
	`deposit_amount` decimal(12,2) NOT NULL DEFAULT '0',
	`cancellation_policy` text,
	`color` varchar(50),
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_invoices` (
	`id` varchar(36) NOT NULL,
	`subscription_id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`number` varchar(50),
	`plan_slug` varchar(50),
	`billing_interval` varchar(20) NOT NULL DEFAULT 'monthly',
	`subtotal` decimal(12,2),
	`discount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`total` decimal(12,2),
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'BRL',
	`payment_method` varchar(50) NOT NULL DEFAULT 'pix',
	`status` varchar(50) NOT NULL DEFAULT 'paid',
	`due_at` timestamp,
	`paid_at` timestamp,
	`failed_at` timestamp,
	`pix_qr_code` text,
	`pix_qr_code_base64` text,
	`pix_copia_e_cola` text,
	`pix_expires_at` timestamp,
	`mercado_pago_payment_id` varchar(100),
	`gateway_status` varchar(50),
	`gateway_status_detail` varchar(100),
	`invoice_url` text,
	`metadata` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscription_invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`plan` varchar(50) NOT NULL DEFAULT 'trial',
	`plan_id` varchar(36),
	`status` varchar(50) NOT NULL DEFAULT 'trialing',
	`billing_interval` varchar(20) NOT NULL DEFAULT 'monthly',
	`amount` decimal(12,2),
	`price_snapshot` decimal(12,2),
	`discount_snapshot` decimal(12,2) DEFAULT '0.00',
	`final_price_snapshot` decimal(12,2),
	`applied_coupon_id` varchar(36),
	`payment_method` varchar(50) DEFAULT 'pix',
	`gateway` varchar(50) NOT NULL DEFAULT 'mercadopago',
	`gateway_customer_id` varchar(100),
	`gateway_subscription_id` varchar(100),
	`gateway_payment_id` varchar(100),
	`trial_ends_at` timestamp NOT NULL,
	`current_period_start` timestamp,
	`current_period_end` timestamp,
	`next_payment_at` timestamp,
	`cancel_at_period_end` boolean NOT NULL DEFAULT false,
	`cancelled_at` timestamp,
	`mercado_pago_subscription_id` varchar(100),
	`mercado_pago_payer_id` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_company_idx` UNIQUE(`company_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36),
	`phone` varchar(50),
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` varchar(50) NOT NULL DEFAULT 'employee',
	`is_superadmin` boolean NOT NULL DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	`email_verified` boolean NOT NULL DEFAULT false,
	`email_verified_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_company_email_idx` UNIQUE(`company_id`,`email`)
);
--> statement-breakpoint
ALTER TABLE `appointment_history` ADD CONSTRAINT `appointment_history_appointment_id_appointments_id_fk` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment_history` ADD CONSTRAINT `appointment_history_actor_id_users_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment_services` ADD CONSTRAINT `appointment_services_appointment_id_appointments_id_fk` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointment_services` ADD CONSTRAINT `appointment_services_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `appointments` ADD CONSTRAINT `appointments_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_tokens` ADD CONSTRAINT `auth_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_events` ADD CONSTRAINT `booking_events_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_membership_usage` ADD CONSTRAINT `booking_membership_usage_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_membership_usage` ADD CONSTRAINT `booking_membership_usage_appointment_id_appointments_id_fk` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_membership_usage` ADD CONSTRAINT `fk_bmu_customer_membership` FOREIGN KEY (`customer_membership_id`) REFERENCES `customer_memberships`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_membership_usage` ADD CONSTRAINT `fk_bmu_membership_period` FOREIGN KEY (`membership_period_id`) REFERENCES `membership_periods`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_membership_usage` ADD CONSTRAINT `booking_membership_usage_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_products` ADD CONSTRAINT `booking_products_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_products` ADD CONSTRAINT `booking_products_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_waitlist` ADD CONSTRAINT `booking_waitlist_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_waitlist` ADD CONSTRAINT `booking_waitlist_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_waitlist` ADD CONSTRAINT `booking_waitlist_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `booking_waitlist` ADD CONSTRAINT `booking_waitlist_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clients` ADD CONSTRAINT `clients_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clients` ADD CONSTRAINT `clients_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `company_memberships` ADD CONSTRAINT `company_memberships_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `company_memberships` ADD CONSTRAINT `company_memberships_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `company_settings` ADD CONSTRAINT `company_settings_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coupons` ADD CONSTRAINT `coupons_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_membership_payments` ADD CONSTRAINT `customer_membership_payments_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_membership_payments` ADD CONSTRAINT `fk_cmp_customer_membership` FOREIGN KEY (`customer_membership_id`) REFERENCES `customer_memberships`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_membership_payments` ADD CONSTRAINT `fk_cmp_membership_period` FOREIGN KEY (`membership_period_id`) REFERENCES `membership_periods`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_memberships` ADD CONSTRAINT `customer_memberships_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_memberships` ADD CONSTRAINT `customer_memberships_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_memberships` ADD CONSTRAINT `customer_memberships_membership_plan_id_membership_plans_id_fk` FOREIGN KEY (`membership_plan_id`) REFERENCES `membership_plans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_memberships` ADD CONSTRAINT `customer_memberships_preferred_professional_id_employees_id_fk` FOREIGN KEY (`preferred_professional_id`) REFERENCES `employees`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_locations` ADD CONSTRAINT `employee_locations_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_locations` ADD CONSTRAINT `employee_locations_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_schedules` ADD CONSTRAINT `employee_schedules_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_schedules` ADD CONSTRAINT `employee_schedules_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_services` ADD CONSTRAINT `employee_services_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_services` ADD CONSTRAINT `employee_services_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `locations` ADD CONSTRAINT `locations_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_periods` ADD CONSTRAINT `membership_periods_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_periods` ADD CONSTRAINT `fk_mp_customer_membership` FOREIGN KEY (`customer_membership_id`) REFERENCES `customer_memberships`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_plan_employees` ADD CONSTRAINT `fk_mpe_membership_plan` FOREIGN KEY (`membership_plan_id`) REFERENCES `membership_plans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_plan_employees` ADD CONSTRAINT `membership_plan_employees_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_plan_services` ADD CONSTRAINT `fk_mps_membership_plan` FOREIGN KEY (`membership_plan_id`) REFERENCES `membership_plans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_plan_services` ADD CONSTRAINT `membership_plan_services_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `membership_plans` ADD CONSTRAINT `membership_plans_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_logs` ADD CONSTRAINT `notification_logs_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_appointment_id_appointments_id_fk` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_appointment_id_appointments_id_fk` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saas_coupon_plans` ADD CONSTRAINT `saas_coupon_plans_coupon_id_saas_coupons_id_fk` FOREIGN KEY (`coupon_id`) REFERENCES `saas_coupons`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saas_coupon_plans` ADD CONSTRAINT `saas_coupon_plans_plan_id_saas_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `saas_plans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saas_coupon_redemptions` ADD CONSTRAINT `saas_coupon_redemptions_coupon_id_saas_coupons_id_fk` FOREIGN KEY (`coupon_id`) REFERENCES `saas_coupons`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saas_coupon_redemptions` ADD CONSTRAINT `saas_coupon_redemptions_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saas_coupon_redemptions` ADD CONSTRAINT `saas_coupon_redemptions_subscription_id_subscriptions_id_fk` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saas_coupon_redemptions` ADD CONSTRAINT `saas_coupon_redemptions_invoice_id_subscription_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `subscription_invoices`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedule_blocks` ADD CONSTRAINT `schedule_blocks_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedule_blocks` ADD CONSTRAINT `schedule_blocks_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedule_blocks` ADD CONSTRAINT `schedule_blocks_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_categories` ADD CONSTRAINT `service_categories_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_category_id_service_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `service_categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription_invoices` ADD CONSTRAINT `subscription_invoices_subscription_id_subscriptions_id_fk` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscription_invoices` ADD CONSTRAINT `subscription_invoices_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_plan_id_saas_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `saas_plans`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_applied_coupon_id_saas_coupons_id_fk` FOREIGN KEY (`applied_coupon_id`) REFERENCES `saas_coupons`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `appointments_company_date_idx` ON `appointments` (`company_id`,`appointment_date`);--> statement-breakpoint
CREATE INDEX `appointments_employee_date_idx` ON `appointments` (`employee_id`,`appointment_date`);--> statement-breakpoint
CREATE INDEX `appointments_company_status_idx` ON `appointments` (`company_id`,`status`);--> statement-breakpoint
CREATE INDEX `audit_logs_company_idx` ON `audit_logs` (`company_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `auth_tokens_user_kind_idx` ON `auth_tokens` (`user_id`,`kind`);--> statement-breakpoint
CREATE INDEX `booking_events_company_event_idx` ON `booking_events` (`company_id`,`event`,`created_at`);--> statement-breakpoint
CREATE INDEX `booking_membership_usage_period_idx` ON `booking_membership_usage` (`membership_period_id`);--> statement-breakpoint
CREATE INDEX `booking_membership_usage_membership_idx` ON `booking_membership_usage` (`customer_membership_id`);--> statement-breakpoint
CREATE INDEX `bookings_user_start_idx` ON `bookings` (`user_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `bookings_company_start_idx` ON `bookings` (`company_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `clients_company_idx` ON `clients` (`company_id`);--> statement-breakpoint
CREATE INDEX `clients_phone_idx` ON `clients` (`phone`);--> statement-breakpoint
CREATE INDEX `company_memberships_company_idx` ON `company_memberships` (`company_id`);--> statement-breakpoint
CREATE INDEX `cust_membership_payments_company_idx` ON `customer_membership_payments` (`company_id`);--> statement-breakpoint
CREATE INDEX `cust_membership_payments_period_idx` ON `customer_membership_payments` (`membership_period_id`);--> statement-breakpoint
CREATE INDEX `customer_memberships_client_idx` ON `customer_memberships` (`client_id`);--> statement-breakpoint
CREATE INDEX `customer_memberships_company_idx` ON `customer_memberships` (`company_id`);--> statement-breakpoint
CREATE INDEX `customer_memberships_plan_idx` ON `customer_memberships` (`membership_plan_id`);--> statement-breakpoint
CREATE INDEX `customer_memberships_status_idx` ON `customer_memberships` (`company_id`,`status`);--> statement-breakpoint
CREATE INDEX `employees_company_idx` ON `employees` (`company_id`);--> statement-breakpoint
CREATE INDEX `locations_company_idx` ON `locations` (`company_id`);--> statement-breakpoint
CREATE INDEX `membership_periods_membership_idx` ON `membership_periods` (`customer_membership_id`);--> statement-breakpoint
CREATE INDEX `membership_periods_range_idx` ON `membership_periods` (`company_id`,`period_start`,`period_end`);--> statement-breakpoint
CREATE INDEX `membership_periods_pay_status_idx` ON `membership_periods` (`company_id`,`payment_status`);--> statement-breakpoint
CREATE INDEX `membership_plans_company_idx` ON `membership_plans` (`company_id`);--> statement-breakpoint
CREATE INDEX `notification_logs_queue_idx` ON `notification_logs` (`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `notifications_company_idx` ON `notifications` (`company_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `payments_appointment_idx` ON `payments` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `products_company_idx` ON `products` (`company_id`);--> statement-breakpoint
CREATE INDEX `reviews_company_idx` ON `reviews` (`company_id`);--> statement-breakpoint
CREATE INDEX `reviews_employee_idx` ON `reviews` (`employee_id`);--> statement-breakpoint
CREATE INDEX `saas_coupon_redemptions_coupon_idx` ON `saas_coupon_redemptions` (`coupon_id`);--> statement-breakpoint
CREATE INDEX `saas_coupon_redemptions_company_idx` ON `saas_coupon_redemptions` (`company_id`);--> statement-breakpoint
CREATE INDEX `saas_coupon_redemptions_sub_idx` ON `saas_coupon_redemptions` (`subscription_id`);--> statement-breakpoint
CREATE INDEX `saas_coupon_redemptions_status_idx` ON `saas_coupon_redemptions` (`status`);--> statement-breakpoint
CREATE INDEX `saas_coupons_active_idx` ON `saas_coupons` (`is_active`);--> statement-breakpoint
CREATE INDEX `saas_coupons_expires_idx` ON `saas_coupons` (`expires_at`);--> statement-breakpoint
CREATE INDEX `saas_plans_active_idx` ON `saas_plans` (`is_active`);--> statement-breakpoint
CREATE INDEX `service_categories_company_idx` ON `service_categories` (`company_id`);--> statement-breakpoint
CREATE INDEX `services_company_idx` ON `services` (`company_id`);--> statement-breakpoint
CREATE INDEX `subscription_invoices_company_idx` ON `subscription_invoices` (`company_id`);--> statement-breakpoint
CREATE INDEX `subscription_invoices_status_idx` ON `subscription_invoices` (`status`);--> statement-breakpoint
CREATE INDEX `subscription_invoices_mp_idx` ON `subscription_invoices` (`mercado_pago_payment_id`);--> statement-breakpoint
CREATE INDEX `subscriptions_status_idx` ON `subscriptions` (`status`);--> statement-breakpoint
CREATE INDEX `subscriptions_plan_idx` ON `subscriptions` (`plan`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);