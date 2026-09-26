CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'equipe' NOT NULL,
	`password` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id` ON `sessions` (`user_id`);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`email` text PRIMARY KEY NOT NULL,
	`fails` integer DEFAULT 0 NOT NULL,
	`until` text NOT NULL
);
