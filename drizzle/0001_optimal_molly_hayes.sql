CREATE TABLE `customer_credentials` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`phone_normalized` varchar(20) NOT NULL,
	`pin_hash` varchar(255) NOT NULL,
	`pin_created_at` timestamp NOT NULL DEFAULT (now()),
	`pin_updated_at` timestamp NOT NULL DEFAULT (now()),
	`failed_attempts` int NOT NULL DEFAULT 0,
	`locked_until` timestamp NULL,
	`last_login_at` timestamp NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_credentials_user_id_idx` UNIQUE(`user_id`),
	CONSTRAINT `customer_credentials_phone_normalized_idx` UNIQUE(`phone_normalized`),
	CONSTRAINT `customer_credentials_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE `customer_access_logs` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NULL,
	`phone_normalized` varchar(20) NOT NULL,
	`action` varchar(50) NOT NULL,
	`ip_address` varchar(64) NULL,
	`user_agent` text NULL,
	`metadata` json NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_access_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_access_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action,
	INDEX `customer_access_logs_phone_idx` (`phone_normalized`),
	INDEX `customer_access_logs_user_id_idx` (`user_id`),
	INDEX `customer_access_logs_action_idx` (`action`),
	INDEX `customer_access_logs_created_idx` (`created_at`)
);