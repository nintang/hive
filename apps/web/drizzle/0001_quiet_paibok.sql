CREATE TABLE `project_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`enabled` integer DEFAULT true,
	`created_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `projects` ADD `last_model_id` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `last_connection_ids` text;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `last_model_id` text;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `last_connection_ids` text;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `tool_mode` text;