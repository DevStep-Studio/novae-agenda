-- Reservei SaaS Billing, Coupons & Mercado Pago Migration
ALTER TABLE `subscriptions` 
  ADD COLUMN `price_snapshot` decimal(12,2) NULL,
  ADD COLUMN `discount_snapshot` decimal(12,2) DEFAULT '0.00' NOT NULL,
  ADD COLUMN `final_price_snapshot` decimal(12,2) NULL,
  ADD COLUMN `applied_coupon_id` varchar(36) NULL,
  ADD COLUMN `gateway_customer_id` varchar(100) NULL,
  ADD COLUMN `next_payment_at` timestamp NULL;

ALTER TABLE `subscription_invoices`
  ADD COLUMN `number` varchar(50) NULL,
  ADD COLUMN `subtotal` decimal(12,2) NULL,
  ADD COLUMN `discount` decimal(12,2) DEFAULT '0.00' NOT NULL,
  ADD COLUMN `total` decimal(12,2) NULL,
  ADD COLUMN `currency` varchar(10) DEFAULT 'BRL' NOT NULL,
  ADD COLUMN `failed_at` timestamp NULL,
  ADD COLUMN `gateway_status` varchar(50) NULL,
  ADD COLUMN `gateway_status_detail` varchar(100) NULL;

CREATE TABLE IF NOT EXISTS `saas_coupons` (
  `id` varchar(36) PRIMARY KEY NOT NULL,
  `code` varchar(50) NOT NULL UNIQUE,
  `name` varchar(100) NOT NULL,
  `description` text NULL,
  `discount_type` varchar(50) NOT NULL,
  `discount_value` decimal(12,2) NOT NULL,
  `max_discount_amount` decimal(12,2) NULL,
  `applies_to` varchar(50) DEFAULT 'ALL_PLANS' NOT NULL,
  `starts_at` timestamp NULL,
  `expires_at` timestamp NULL,
  `max_redemptions` int NULL,
  `max_redemptions_per_business` int DEFAULT 1 NOT NULL,
  `duration_type` varchar(50) DEFAULT 'ONCE' NOT NULL,
  `duration_cycles` int DEFAULT 1,
  `minimum_plan_amount` decimal(12,2) NULL,
  `is_active` boolean DEFAULT true NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX `saas_coupons_active_idx` (`is_active`),
  INDEX `saas_coupons_expires_idx` (`expires_at`)
);

CREATE TABLE IF NOT EXISTS `saas_coupon_plans` (
  `coupon_id` varchar(36) NOT NULL,
  `plan_id` varchar(36) NOT NULL,
  PRIMARY KEY (`coupon_id`, `plan_id`),
  CONSTRAINT `fk_coupon_plans_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `saas_coupons`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_coupon_plans_plan` FOREIGN KEY (`plan_id`) REFERENCES `saas_plans`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `saas_coupon_redemptions` (
  `id` varchar(36) PRIMARY KEY NOT NULL,
  `coupon_id` varchar(36) NOT NULL,
  `company_id` varchar(36) NOT NULL,
  `subscription_id` varchar(36) NULL,
  `invoice_id` varchar(36) NULL,
  `original_amount` decimal(12,2) NOT NULL,
  `discount_amount` decimal(12,2) NOT NULL,
  `final_amount` decimal(12,2) NOT NULL,
  `cycle_number` int DEFAULT 1 NOT NULL,
  `status` varchar(50) DEFAULT 'pending' NOT NULL,
  `redeemed_at` timestamp NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX `saas_coupon_redemptions_coupon_idx` (`coupon_id`),
  INDEX `saas_coupon_redemptions_company_idx` (`company_id`),
  INDEX `saas_coupon_redemptions_status_idx` (`status`),
  CONSTRAINT `fk_redemptions_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `saas_coupons`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_redemptions_company` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE
);
