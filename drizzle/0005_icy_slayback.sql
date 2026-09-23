CREATE TABLE `notification_schedules` (
	`id` varchar(36) NOT NULL,
	`booking_id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`event_type` varchar(50) NOT NULL,
	`recipient_type` varchar(20) NOT NULL,
	`recipient_id` varchar(36),
	`scheduled_for` timestamp NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`sent_at` timestamp,
	`cancelled_at` timestamp,
	`idempotency_key` varchar(128) NOT NULL,
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notification_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_schedules_idempotency_idx` UNIQUE(`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `push_devices` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36),
	`customer_id` varchar(36),
	`company_id` varchar(36),
	`provider` varchar(50) NOT NULL DEFAULT 'expo',
	`push_token` varchar(255) NOT NULL,
	`platform` varchar(20) NOT NULL DEFAULT 'unknown',
	`device_identifier` varchar(100),
	`app_version` varchar(50),
	`environment` varchar(20) NOT NULL DEFAULT 'production',
	`is_active` boolean NOT NULL DEFAULT true,
	`last_registered_at` timestamp NOT NULL DEFAULT (now()),
	`last_success_at` timestamp,
	`last_failure_at` timestamp,
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `push_devices_token_idx` UNIQUE(`push_token`)
);
--> statement-breakpoint
ALTER TABLE `notification_schedules` ADD CONSTRAINT `notification_schedules_booking_id_bookings_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_schedules` ADD CONSTRAINT `notification_schedules_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `push_devices` ADD CONSTRAINT `push_devices_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `push_devices` ADD CONSTRAINT `push_devices_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `notification_schedules_queue_idx` ON `notification_schedules` (`status`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `notification_schedules_booking_idx` ON `notification_schedules` (`booking_id`);--> statement-breakpoint
CREATE INDEX `push_devices_user_idx` ON `push_devices` (`user_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `push_devices_customer_idx` ON `push_devices` (`customer_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `push_devices_company_idx` ON `push_devices` (`company_id`,`is_active`);