-- Add persisted chat settings to user_preferences table
ALTER TABLE `user_preferences` ADD COLUMN `last_model_id` text;
--> statement-breakpoint
ALTER TABLE `user_preferences` ADD COLUMN `last_connection_ids` text;
--> statement-breakpoint
ALTER TABLE `user_preferences` ADD COLUMN `tool_mode` text;
