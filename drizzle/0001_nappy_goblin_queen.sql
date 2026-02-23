CREATE TABLE `email_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`status` enum('sent','failed','skipped') NOT NULL DEFAULT 'sent',
	`fubEventId` varchar(200),
	`pdfUrl` text,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`address` varchar(500) NOT NULL,
	`city` varchar(100),
	`state` varchar(50),
	`zip` varchar(20),
	`mlsNumber` varchar(50),
	`listPrice` decimal(12,2),
	`listDate` timestamp,
	`targetCloseDate` timestamp,
	`heroPhotoUrl` text,
	`status` enum('Active','Under Contract','Sold','Back on Market','Withdrawn') NOT NULL DEFAULT 'Active',
	`agentName` varchar(200),
	`agentEmail` varchar(320),
	`agentPhone` varchar(50),
	`agentPhotoUrl` text,
	`sellerName` varchar(200),
	`sellerEmail` varchar(320),
	`fubContactId` varchar(100),
	`weeklyNarrative` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `listings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `magic_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `magic_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `magic_links_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int NOT NULL,
	`offerDate` timestamp NOT NULL,
	`offerPrice` decimal(12,2),
	`status` enum('Active','Countered','Declined','Accepted','Expired') NOT NULL DEFAULT 'Active',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `offers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `showings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int NOT NULL,
	`showingDate` timestamp NOT NULL,
	`buyerAgentName` varchar(200),
	`buyerAgentEmail` varchar(320),
	`feedbackSummary` text,
	`starRating` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `showings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int NOT NULL,
	`platform` enum('Instagram','Facebook','TikTok','YouTube','LinkedIn','Twitter','Other') NOT NULL,
	`postUrl` text,
	`thumbnailUrl` text,
	`impressions` int DEFAULT 0,
	`reach` int DEFAULT 0,
	`linkClicks` int DEFAULT 0,
	`videoViews` int DEFAULT 0,
	`postedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `social_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int NOT NULL,
	`title` varchar(300) NOT NULL,
	`platform` enum('YouTube','Instagram','TikTok','Facebook','Other') NOT NULL,
	`videoUrl` text,
	`thumbnailUrl` text,
	`viewCount` int DEFAULT 0,
	`watchTimeMinutes` int DEFAULT 0,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `video_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weekly_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listingId` int NOT NULL,
	`weekOf` timestamp NOT NULL,
	`zillowViews` int DEFAULT 0,
	`realtorViews` int DEFAULT 0,
	`redfinViews` int DEFAULT 0,
	`websiteViews` int DEFAULT 0,
	`totalImpressions` int DEFAULT 0,
	`totalVideoViews` int DEFAULT 0,
	`totalShowings` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `email_log` ADD CONSTRAINT `email_log_listingId_listings_id_fk` FOREIGN KEY (`listingId`) REFERENCES `listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `listings` ADD CONSTRAINT `listings_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `magic_links` ADD CONSTRAINT `magic_links_listingId_listings_id_fk` FOREIGN KEY (`listingId`) REFERENCES `listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `offers` ADD CONSTRAINT `offers_listingId_listings_id_fk` FOREIGN KEY (`listingId`) REFERENCES `listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `showings` ADD CONSTRAINT `showings_listingId_listings_id_fk` FOREIGN KEY (`listingId`) REFERENCES `listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `social_posts` ADD CONSTRAINT `social_posts_listingId_listings_id_fk` FOREIGN KEY (`listingId`) REFERENCES `listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `video_stats` ADD CONSTRAINT `video_stats_listingId_listings_id_fk` FOREIGN KEY (`listingId`) REFERENCES `listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weekly_stats` ADD CONSTRAINT `weekly_stats_listingId_listings_id_fk` FOREIGN KEY (`listingId`) REFERENCES `listings`(`id`) ON DELETE cascade ON UPDATE no action;