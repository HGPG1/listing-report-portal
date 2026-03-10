import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  bigint,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

// ─── Users ─────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Listings ──────────────────────────────────────────────────────────────
export const listings = mysqlTable("listings", {
  id: int("id").autoincrement().primaryKey(),
  // Property details
  address: varchar("address", { length: 500 }).notNull(),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zip: varchar("zip", { length: 20 }),
  mlsNumber: varchar("mlsNumber", { length: 50 }),
  listPrice: decimal("listPrice", { precision: 12, scale: 2 }),
  listDate: timestamp("listDate"),
  targetCloseDate: timestamp("targetCloseDate"),
  heroPhotoUrl: text("heroPhotoUrl"),
  status: mysqlEnum("status", ["Active", "Under Contract", "Sold", "Back on Market", "Withdrawn"])
    .default("Active").notNull(),
  // Agent info
  agentName: varchar("agentName", { length: 200 }),
  agentEmail: varchar("agentEmail", { length: 320 }),
  agentPhone: varchar("agentPhone", { length: 50 }),
  agentPhotoUrl: text("agentPhotoUrl"),
  // Seller info
  sellerName: varchar("sellerName", { length: 200 }),
  sellerEmail: varchar("sellerEmail", { length: 320 }),
  fubContactId: varchar("fubContactId", { length: 100 }),
  // Weekly narrative
  weeklyNarrative: text("weeklyNarrative"),
  // Archive tracking
  isArchived: boolean("isArchived").default(false).notNull(),
  archivedAt: timestamp("archivedAt"),
  // Ownership
  createdByUserId: int("createdByUserId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});

export type Listing = typeof listings.$inferSelect;
export type InsertListing = typeof listings.$inferInsert;

// ─── Magic Links ───────────────────────────────────────────────────────────
export const magicLinks = mysqlTable("magic_links", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").notNull().references(() => listings.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MagicLink = typeof magicLinks.$inferSelect;
export type InsertMagicLink = typeof magicLinks.$inferInsert;

// ─── Weekly Portal Stats ───────────────────────────────────────────────────
export const weeklyStats = mysqlTable("weekly_stats", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").notNull().references(() => listings.id, { onDelete: "cascade" }),
  syncPeriod: mysqlEnum("syncPeriod", ["7day", "30day", "lifetime"]).notNull(),
  weekOf: timestamp("weekOf").notNull(), // Date when sync was performed
  zillowViews: int("zillowViews").default(0),
  realtorViews: int("realtorViews").default(0),
  redfinViews: int("redfinViews").default(0),
  websiteViews: int("websiteViews").default(0),
  // Aggregated social totals for the week
  totalImpressions: int("totalImpressions").default(0),
  totalVideoViews: int("totalVideoViews").default(0),
  totalShowings: int("totalShowings").default(0),
  // ListTrac metrics (expanded)
  listtracViews: int("listtracViews").default(0),
  listtracInquiries: int("listtracInquiries").default(0),
  listtracShares: int("listtracShares").default(0),
  listtracFavorites: int("listtracFavorites").default(0),
  listtracVTourViews: int("listtracVTourViews").default(0),
  // Major platform tracking (extracted from ListTrac)
  zillowListtracViews: int("zillowListtracViews").default(0),
  realtorListtracViews: int("realtorListtracViews").default(0),
  mlsListtracViews: int("mlsListtracViews").default(0),
  oneHomeListtracViews: int("oneHomeListtracViews").default(0),
  truliaListtracViews: int("truliaListtracViews").default(0),
  otherSourcesListtracViews: int("otherSourcesListtracViews").default(0),
  // Date range tracking (for custom date range syncs)
  dateRangeStart: timestamp("dateRangeStart"),
  dateRangeEnd: timestamp("dateRangeEnd"),
  // Platform breakdown (JSON string: {"Zillow": 100, "Realtor.com": 50, ...})
  platformBreakdown: text("platformBreakdown"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WeeklyStat = typeof weeklyStats.$inferSelect;
export type InsertWeeklyStat = typeof weeklyStats.$inferInsert;

// ─── ListTrac Sync Logs ────────────────────────────────────────────────────
export const listracSyncLogs = mysqlTable("listtrac_sync_logs", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").notNull().references(() => listings.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["success", "error"]).notNull(),
  viewsCount: int("viewsCount"),
  inquiriesCount: int("inquiriesCount"),
  sharesCount: int("sharesCount"),
  favoritesCount: int("favoritesCount"),
  errorMessage: text("errorMessage"),
  syncedAt: timestamp("syncedAt").notNull(),
});

export type ListracSyncLog = typeof listracSyncLogs.$inferSelect;
export type InsertListracSyncLog = typeof listracSyncLogs.$inferInsert;

// ─── Social Posts ──────────────────────────────────────────────────────────
export const socialPosts = mysqlTable("social_posts", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").notNull().references(() => listings.id, { onDelete: "cascade" }),
  platform: mysqlEnum("platform", ["Instagram", "Facebook", "TikTok", "YouTube", "LinkedIn", "Twitter", "Other"])
    .notNull(),
  postUrl: text("postUrl"),
  thumbnailUrl: text("thumbnailUrl"),
  impressions: int("impressions").default(0),
  reach: int("reach").default(0),
  linkClicks: int("linkClicks").default(0),
  videoViews: int("videoViews").default(0),
  postedAt: timestamp("postedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = typeof socialPosts.$inferInsert;

// ─── Video Stats ───────────────────────────────────────────────────────────
export const videoStats = mysqlTable("video_stats", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").notNull().references(() => listings.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 300 }).notNull(),
  platform: mysqlEnum("platform", ["YouTube", "Instagram", "TikTok", "Facebook", "Other"]).notNull(),
  videoUrl: text("videoUrl"),
  thumbnailUrl: text("thumbnailUrl"),
  viewCount: int("viewCount").default(0),
  watchTimeMinutes: int("watchTimeMinutes").default(0),
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VideoStat = typeof videoStats.$inferSelect;
export type InsertVideoStat = typeof videoStats.$inferInsert;

// ─── Showings Feedback ─────────────────────────────────────────────────────
export const showings = mysqlTable("showings", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").notNull().references(() => listings.id, { onDelete: "cascade" }),
  showingDate: timestamp("showingDate").notNull(),
  buyerAgentName: varchar("buyerAgentName", { length: 200 }),
  buyerAgentEmail: varchar("buyerAgentEmail", { length: 320 }),
  feedbackSummary: text("feedbackSummary"),
  starRating: int("starRating"), // 1-5
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Showing = typeof showings.$inferSelect;
export type InsertShowing = typeof showings.$inferInsert;

// ─── Offers ────────────────────────────────────────────────────────────────
export const offers = mysqlTable("offers", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").notNull().references(() => listings.id, { onDelete: "cascade" }),
  offerDate: timestamp("offerDate").notNull(),
  offerPrice: decimal("offerPrice", { precision: 12, scale: 2 }),
  status: mysqlEnum("status", ["Active", "Countered", "Declined", "Accepted", "Expired"])
    .default("Active").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Offer = typeof offers.$inferSelect;
export type InsertOffer = typeof offers.$inferInsert;

// ─── Email Log ─────────────────────────────────────────────────────────────
export const emailLog = mysqlTable("email_log", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").notNull().references(() => listings.id, { onDelete: "cascade" }),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  status: mysqlEnum("status", ["sent", "failed", "skipped"]).default("sent").notNull(),
  fubEventId: varchar("fubEventId", { length: 200 }),
  pdfUrl: text("pdfUrl"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailLogEntry = typeof emailLog.$inferSelect;
export type InsertEmailLogEntry = typeof emailLog.$inferInsert;

// ─── Zillow Sync Logs ─────────────────────────────────────────────────────
export const zillowSyncLogs = mysqlTable("zillow_sync_logs", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").references(() => listings.id, { onDelete: "cascade" }),
  mlsNumber: varchar("mlsNumber", { length: 50 }),
  feedId: int("feedId"),
  status: mysqlEnum("status", ["success", "failed", "skipped"]).notNull(),
  // Data pulled from Zillow
  zillowViews: int("zillowViews"),
  zillowImpressions: int("zillowImpressions"),
  zillowContacts: int("zillowContacts"),
  // Error details
  errorMessage: text("errorMessage"),
  httpStatus: int("httpStatus"),
  responseBody: text("responseBody"),
  tokenSecretUsed: varchar("tokenSecretUsed", { length: 20 }), // 'none' or 'empty'
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});
export type ZillowSyncLog = typeof zillowSyncLogs.$inferSelect;
export type InsertZillowSyncLog = typeof zillowSyncLogs.$inferInsert;

// ─── Relations ─────────────────────────────────────────────────────────────
export const listingsRelations = relations(listings, ({ many, one }) => ({
  magicLinks: many(magicLinks),
  weeklyStats: many(weeklyStats),
  socialPosts: many(socialPosts),
  videoStats: many(videoStats),
  showings: many(showings),
  offers: many(offers),
  emailLog: many(emailLog),
  createdBy: one(users, { fields: [listings.createdByUserId], references: [users.id] }),
}));

export const magicLinksRelations = relations(magicLinks, ({ one }) => ({
  listing: one(listings, { fields: [magicLinks.listingId], references: [listings.id] }),
}));

export const weeklyStatsRelations = relations(weeklyStats, ({ one }) => ({
  listing: one(listings, { fields: [weeklyStats.listingId], references: [listings.id] }),
}));

export const socialPostsRelations = relations(socialPosts, ({ one }) => ({
  listing: one(listings, { fields: [socialPosts.listingId], references: [listings.id] }),
}));

export const videoStatsRelations = relations(videoStats, ({ one }) => ({
  listing: one(listings, { fields: [videoStats.listingId], references: [listings.id] }),
}));

export const showingsRelations = relations(showings, ({ one }) => ({
  listing: one(listings, { fields: [showings.listingId], references: [listings.id] }),
}));

export const offersRelations = relations(offers, ({ one }) => ({
  listing: one(listings, { fields: [offers.listingId], references: [listings.id] }),
}));

export const emailLogRelations = relations(emailLog, ({ one }) => ({
  listing: one(listings, { fields: [emailLog.listingId], references: [listings.id] }),
}));

export const zillowSyncLogsRelations = relations(zillowSyncLogs, ({ one }) => ({
  listing: one(listings, { fields: [zillowSyncLogs.listingId], references: [listings.id] }),
}));

// ─── ShowingTime Requests ──────────────────────────────────────────────────
export const showingRequests = mysqlTable("showing_requests", {
  id: int("id").autoincrement().primaryKey(),
  listingId: int("listingId").notNull().references(() => listings.id, { onDelete: "cascade" }),
  // Property details from email
  address: varchar("address", { length: 500 }).notNull(),
  mlsNumber: varchar("mlsNumber", { length: 50 }),
  listPrice: decimal("listPrice", { precision: 12, scale: 2 }),
  // Showing details
  requestedTime: timestamp("requestedTime"), // Original requested time
  confirmedTime: timestamp("confirmedTime"), // Confirmed/rescheduled time
  timeSlot: varchar("timeSlot", { length: 100 }), // "1:00 PM - 2:00 PM" format
  // Status tracking
  status: mysqlEnum("status", ["requested", "rescheduled", "confirmed", "completed", "cancelled"]).default("requested").notNull(),
  // Participant info
  buyerName: varchar("buyerName", { length: 200 }),
  listingAgent: varchar("listingAgent", { length: 200 }),
  showingAgent: varchar("showingAgent", { length: 200 }),
  // Email tracking
  emailSubject: text("emailSubject"),
  emailMessageId: varchar("emailMessageId", { length: 500 }).unique(),
  rawEmailBody: text("rawEmailBody"),
  // Feedback
  feedback: text("feedback"),
  rating: int("rating"), // 1-5 star rating
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ShowingRequest = typeof showingRequests.$inferSelect;
export type InsertShowingRequest = typeof showingRequests.$inferInsert;

export const showingRequestsRelations = relations(showingRequests, ({ one }) => ({
  listing: one(listings, { fields: [showingRequests.listingId], references: [listings.id] }),
}));
