import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  emailLog,
  InsertEmailLogEntry,
  InsertListing,
  InsertMagicLink,
  InsertOffer,
  InsertShowing,
  InsertSocialPost,
  InsertUser,
  InsertVideoStat,
  InsertWeeklyStat,
  listings,
  magicLinks,
  offers,
  showings,
  socialPosts,
  users,
  videoStats,
  weeklyStats,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ─────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }

  // Auto-promote owner or approved emails to admin
  const email = user.email ?? "";
  const isApproved =
    email === "brianmccarron@gmail.com" ||
    email.endsWith("@homegrownpropertygroup.com") ||
    user.openId === ENV.ownerOpenId;

  if (isApproved) {
    values.role = "admin";
    updateSet.role = "admin";
  } else if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Listings ──────────────────────────────────────────────────────────────
export async function getAllListings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(listings).orderBy(desc(listings.createdAt));
}

export async function getListingById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  return result[0];
}

export async function createListing(data: InsertListing) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(listings).values(data);
  return result[0];
}

export async function updateListing(id: number, data: Partial<InsertListing>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(listings).set(data).where(eq(listings.id, id));
}

export async function deleteListing(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(listings).where(eq(listings.id, id));
}

export async function getFullListingData(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [listing, stats, social, videos, showingsList, offersList, emailLogs] = await Promise.all([
    db.select().from(listings).where(eq(listings.id, id)).limit(1),
    db.select().from(weeklyStats).where(eq(weeklyStats.listingId, id)).orderBy(desc(weeklyStats.weekOf)),
    db.select().from(socialPosts).where(eq(socialPosts.listingId, id)).orderBy(desc(socialPosts.postedAt)),
    db.select().from(videoStats).where(eq(videoStats.listingId, id)).orderBy(desc(videoStats.publishedAt)),
    db.select().from(showings).where(eq(showings.listingId, id)).orderBy(desc(showings.showingDate)),
    db.select().from(offers).where(eq(offers.listingId, id)).orderBy(desc(offers.offerDate)),
    db.select().from(emailLog).where(eq(emailLog.listingId, id)).orderBy(desc(emailLog.sentAt)).limit(20),
  ]);
  if (!listing[0]) return null;
  return {
    listing: listing[0],
    weeklyStats: stats,
    socialPosts: social,
    videoStats: videos,
    showings: showingsList,
    offers: offersList,
    emailLog: emailLogs,
  };
}

// ─── Magic Links ───────────────────────────────────────────────────────────
export async function createMagicLink(data: InsertMagicLink) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Deactivate existing links for this listing
  await db.update(magicLinks)
    .set({ isActive: false })
    .where(eq(magicLinks.listingId, data.listingId));
  await db.insert(magicLinks).values(data);
}

export async function getMagicLinkByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(magicLinks)
    .where(and(eq(magicLinks.token, token), eq(magicLinks.isActive, true)))
    .limit(1);
  return result[0];
}

export async function getActiveMagicLinkForListing(listingId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(magicLinks)
    .where(and(eq(magicLinks.listingId, listingId), eq(magicLinks.isActive, true)))
    .orderBy(desc(magicLinks.createdAt))
    .limit(1);
  return result[0];
}

// ─── Weekly Stats ──────────────────────────────────────────────────────────
export async function upsertWeeklyStats(data: InsertWeeklyStat) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await db.select().from(weeklyStats)
    .where(and(eq(weeklyStats.listingId, data.listingId), eq(weeklyStats.weekOf, data.weekOf!)))
    .limit(1);
  if (existing[0]) {
    await db.update(weeklyStats).set(data).where(eq(weeklyStats.id, existing[0].id));
  } else {
    await db.insert(weeklyStats).values(data);
  }
}

export async function getWeeklyStatsForListing(listingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(weeklyStats)
    .where(eq(weeklyStats.listingId, listingId))
    .orderBy(desc(weeklyStats.weekOf));
}

// ─── Social Posts ──────────────────────────────────────────────────────────
export async function createSocialPost(data: InsertSocialPost) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(socialPosts).values(data);
}

export async function updateSocialPost(id: number, data: Partial<InsertSocialPost>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(socialPosts).set(data).where(eq(socialPosts.id, id));
}

export async function deleteSocialPost(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(socialPosts).where(eq(socialPosts.id, id));
}

// ─── Video Stats ───────────────────────────────────────────────────────────
export async function createVideoStat(data: InsertVideoStat) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(videoStats).values(data);
}

export async function updateVideoStat(id: number, data: Partial<InsertVideoStat>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(videoStats).set(data).where(eq(videoStats.id, id));
}

export async function deleteVideoStat(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(videoStats).where(eq(videoStats.id, id));
}

// ─── Showings ──────────────────────────────────────────────────────────────
export async function createShowing(data: InsertShowing) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(showings).values(data);
}

export async function updateShowing(id: number, data: Partial<InsertShowing>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(showings).set(data).where(eq(showings.id, id));
}

export async function deleteShowing(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(showings).where(eq(showings.id, id));
}

// ─── Offers ────────────────────────────────────────────────────────────────
export async function createOffer(data: InsertOffer) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(offers).values(data);
}

export async function updateOffer(id: number, data: Partial<InsertOffer>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(offers).set(data).where(eq(offers.id, id));
}

export async function deleteOffer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(offers).where(eq(offers.id, id));
}

// ─── Email Log ─────────────────────────────────────────────────────────────
export async function logEmail(data: InsertEmailLogEntry) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(emailLog).values(data);
}

export async function getEmailLogForListing(listingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailLog)
    .where(eq(emailLog.listingId, listingId))
    .orderBy(desc(emailLog.sentAt))
    .limit(50);
}

// ─── Analytics ─────────────────────────────────────────────────────────────
export async function getAnalyticsOverview() {
  const db = await getDb();
  if (!db) return null;
  const [allListings, allStats] = await Promise.all([
    db.select().from(listings).orderBy(desc(listings.createdAt)),
    db.select().from(weeklyStats).orderBy(desc(weeklyStats.weekOf)),
  ]);
  return { listings: allListings, weeklyStats: allStats };
}

export async function getActiveListingsForCron() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(listings)
    .where(and(
      eq(listings.status, "Active"),
    ));
}

export async function getAllWithStats() {
  const db = await getDb();
  if (!db) return [];
  const allListings = await db.select().from(listings).orderBy(listings.id);
  const allStats = await db.select().from(weeklyStats).orderBy(desc(weeklyStats.weekOf));
  
  return allListings.map(listing => ({
    ...listing,
    weeklyStats: allStats.filter(stat => stat.listingId === listing.id),
  }));
}
