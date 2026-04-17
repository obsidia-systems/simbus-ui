CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`docker_container_id` text,
	`docker_container_name` text NOT NULL,
	`internal_modbus_port` integer DEFAULT 502 NOT NULL,
	`internal_api_port` integer DEFAULT 8000 NOT NULL,
	`host_modbus_port` integer,
	`host_api_port` integer,
	`tick_interval` real DEFAULT 1 NOT NULL,
	`seed` integer,
	`yaml_config` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_docker_container_name_unique` ON `devices` (`docker_container_name`);