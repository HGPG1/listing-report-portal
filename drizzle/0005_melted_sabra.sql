ALTER TABLE `listings` ADD `isArchived` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `listings` ADD `archivedAt` timestamp;