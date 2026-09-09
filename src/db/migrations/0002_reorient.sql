DROP TABLE `devices`;
--> statement-breakpoint
DROP TABLE `templates`;
--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`preset_id` text,
	`instance_path` text NOT NULL,
	`yaml_hash` text NOT NULL,
	`docker_container_id` text,
	`docker_container_name` text NOT NULL,
	`tick_interval` real DEFAULT 1 NOT NULL,
	`time_scale` real DEFAULT 1 NOT NULL,
	`seed` integer,
	`desired_state` text DEFAULT 'running' NOT NULL,
	`control_host_port` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_docker_container_name_unique` ON `devices` (`docker_container_name`);
--> statement-breakpoint
CREATE TABLE `port_leases` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`protocol` text NOT NULL,
	`container_port` integer NOT NULL,
	`host_port` integer NOT NULL,
	`proto` text DEFAULT 'tcp' NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`source_preset_id` text,
	`yaml_config` text NOT NULL,
	`created_at` integer NOT NULL
);
