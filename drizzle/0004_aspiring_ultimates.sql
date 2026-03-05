ALTER TABLE `weekly_stats` ADD `listtracShares` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `weekly_stats` ADD `listtracFavorites` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `weekly_stats` ADD `listtracVTourViews` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `weekly_stats` ADD `dateRangeStart` timestamp;--> statement-breakpoint
ALTER TABLE `weekly_stats` ADD `dateRangeEnd` timestamp;--> statement-breakpoint
ALTER TABLE `weekly_stats` ADD `platformBreakdown` text;