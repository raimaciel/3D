-- Gestao 3D: cria todas as tabelas do banco.
-- Cole este arquivo INTEIRO no console do banco D1, no painel da Cloudflare,
-- e execute. Precisa ser feito uma unica vez.

-- === dados do sistema ===
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated` text NOT NULL
);

-- === login, sessao e trava de senha ===
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'equipe' NOT NULL,
	`password` text NOT NULL,
	`created` text NOT NULL
);

CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` text NOT NULL,
	`created` text NOT NULL
);

CREATE INDEX `sessions_user_id` ON `sessions` (`user_id`);

CREATE TABLE `login_attempts` (
	`email` text PRIMARY KEY NOT NULL,
	`fails` integer DEFAULT 0 NOT NULL,
	`until` text NOT NULL
);
