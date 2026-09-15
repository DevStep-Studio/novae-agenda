ALTER TABLE `subscriptions`
  ADD `trial_started_at` timestamp NULL AFTER `gateway_payment_id`;
--> statement-breakpoint

UPDATE `subscriptions`
SET `trial_started_at` = DATE_SUB(`trial_ends_at`, INTERVAL 7 DAY)
WHERE `trial_started_at` IS NULL;
--> statement-breakpoint

CREATE INDEX `subscriptions_trial_ends_idx`
  ON `subscriptions` (`trial_ends_at`);
