CREATE TABLE `admin_audit_logs` (
	`id` varchar(36) NOT NULL,
	`admin_user_id` varchar(36) NOT NULL,
	`admin_email` varchar(255) NOT NULL,
	`action` varchar(100) NOT NULL,
	`entity` varchar(50) NOT NULL,
	`entity_id` varchar(36),
	`entity_name` varchar(255),
	`reason` text,
	`before_state` json,
	`after_state` json,
	`ip_address` varchar(64),
	`user_agent` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `clients` ADD `document` varchar(30);--> statement-breakpoint
ALTER TABLE `clients` ADD `deleted_at` timestamp;--> statement-breakpoint
ALTER TABLE `clients` ADD `deleted_by` varchar(36);--> statement-breakpoint
ALTER TABLE `companies` ADD `cnpj_or_cpf` varchar(30);--> statement-breakpoint
ALTER TABLE `companies` ADD `origin_coupon_id` varchar(36);--> statement-breakpoint
ALTER TABLE `companies` ADD `deleted_at` timestamp;--> statement-breakpoint
ALTER TABLE `companies` ADD `deleted_by` varchar(36);--> statement-breakpoint
ALTER TABLE `employees` ADD `deleted_at` timestamp;--> statement-breakpoint
ALTER TABLE `employees` ADD `deleted_by` varchar(36);--> statement-breakpoint
ALTER TABLE `saas_coupon_redemptions` ADD `is_converted` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `saas_coupon_redemptions` ADD `converted_at` timestamp;--> statement-breakpoint
ALTER TABLE `saas_coupons` ADD `influencer_name` varchar(150);--> statement-breakpoint
ALTER TABLE `saas_coupons` ADD `influencer_contact` varchar(150);--> statement-breakpoint
ALTER TABLE `saas_coupons` ADD `commission_type` varchar(50) DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE `saas_coupons` ADD `commission_value` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `origin` varchar(50) DEFAULT 'checkout' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `granted_by_admin_id` varchar(36);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `grant_reason` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `revoked_by_admin_id` varchar(36);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `revoke_reason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `admin_role` varchar(50) DEFAULT 'super_admin';--> statement-breakpoint
ALTER TABLE `users` ADD `deleted_at` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `deleted_by` varchar(36);--> statement-breakpoint
ALTER TABLE `admin_audit_logs` ADD CONSTRAINT `admin_audit_logs_admin_user_id_users_id_fk` FOREIGN KEY (`admin_user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admin_audit_logs_admin_idx` ON `admin_audit_logs` (`admin_user_id`);--> statement-breakpoint
CREATE INDEX `admin_audit_logs_entity_idx` ON `admin_audit_logs` (`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `admin_audit_logs_action_idx` ON `admin_audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `admin_audit_logs_created_idx` ON `admin_audit_logs` (`created_at`);