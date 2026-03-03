CREATE TABLE `zillow_sync_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int,
	`mlsNumber` varchar(50),
	`feedId` int,
	`status` enum('success','failed','skipped') NOT NULL,
	`zillowViews` int,
	`zillowImpressions` int,
	`zillowContacts` int,
	`errorMessage` text,
	`httpStatus` int,
	`responseBody` text,
	`tokenSecretUsed` varchar(20),
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `zillow_sync_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `zillow_sync_logs` ADD CONSTRAINT `zillow_sync_logs_listingId_listings_id_fk` FOREIGN KEY (`listingId`) REFERENCES `listings`(`id`) ON DELETE cascade ON UPDATE no action;