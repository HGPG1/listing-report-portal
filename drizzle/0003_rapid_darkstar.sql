CREATE TABLE `listtrac_sync_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int NOT NULL,
	`status` enum('success','error') NOT NULL,
	`viewsCount` int,
	`inquiriesCount` int,
	`sharesCount` int,
	`favoritesCount` int,
	`errorMessage` text,
	`syncedAt` timestamp NOT NULL,
	CONSTRAINT `listtrac_sync_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `weekly_stats` ADD `listtracViews` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `weekly_stats` ADD `listtracInquiries` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `listtrac_sync_logs` ADD CONSTRAINT `listtrac_sync_logs_listingId_listings_id_fk` FOREIGN KEY (`listingId`) REFERENCES `listings`(`id`) ON DELETE cascade ON UPDATE no action;