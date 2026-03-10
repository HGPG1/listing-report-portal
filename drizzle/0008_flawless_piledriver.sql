CREATE TABLE `showing_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int NOT NULL,
	`address` varchar(500) NOT NULL,
	`mlsNumber` varchar(50),
	`listPrice` decimal(12,2),
	`requestedTime` timestamp,
	`confirmedTime` timestamp,
	`timeSlot` varchar(100),
	`status` enum('requested','rescheduled','confirmed','completed','cancelled') NOT NULL DEFAULT 'requested',
	`buyerName` varchar(200),
	`listingAgent` varchar(200),
	`showingAgent` varchar(200),
	`emailSubject` text,
	`emailMessageId` varchar(500),
	`rawEmailBody` text,
	`feedback` text,
	`rating` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `showing_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `showing_requests_emailMessageId_unique` UNIQUE(`emailMessageId`)
);
--> statement-breakpoint
ALTER TABLE `showing_requests` ADD CONSTRAINT `showing_requests_listingId_listings_id_fk` FOREIGN KEY (`listingId`) REFERENCES `listings`(`id`) ON DELETE cascade ON UPDATE no action;