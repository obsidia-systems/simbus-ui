CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`internal_modbus_port` integer DEFAULT 502 NOT NULL,
	`internal_api_port` integer DEFAULT 8000 NOT NULL,
	`tick_interval` real DEFAULT 1 NOT NULL,
	`seed` integer,
	`yaml_config` text,
	`created_at` integer NOT NULL
);
