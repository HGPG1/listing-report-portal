/**
 * ListTrac API Integration (Enhanced)
 * Pulls listing metrics: views, inquiries, shares, favorites, virtual tours
 * Includes platform-specific breakdown (Zillow, Realtor.com, Redfin, etc.)
 *
 * Flow:
 *   1. Call getKey() → get GUID
 *   2. MD5(password + GUID) → get token
 *   3. POST to GetMetricsByOrganization with token + listing ID → get metrics
 *   4. Parse response: aggregate totals + platform breakdown
 *   5. Upsert into weekly_stats with all metrics
 *   6. Log result in listtrac_sync_logs
 */

import crypto from "crypto";
import { getDb } from "./db";
import {
  listings,
  weeklyStats,
  listracSyncLogs,
  InsertListracSyncLog,
} from "../drizzle/schema";
import { eq, and, gte, lte } from "drizzle-orm";


// ─── Credentials ─────────────────────────────────────────────────────────────
const LISTTRAC_BASE_URL = "https://b2b.listtrac.com/api";
const ORG_ID = process.env.LISTTRAC_ORG_ID ?? "canopy";
const USERNAME = process.env.LISTTRAC_USERNAME ?? "44890";
const PASSWORD = process.env.LISTTRAC_PASSWORD ?? "HomeGrown2026!";

// Cached token (valid for the session)
let cachedToken: string | null = null;
let cachedTokenTime: number = 0;
const TOKEN_CACHE_TTL = 3600000; // 1 hour in milliseconds

// ─── Token Generation ───────────────────────────────────────────────────────
async function getKey(): Promise<string> {
  const url = `${LISTTRAC_BASE_URL}/getkey?orgID=${ORG_ID}&username=${USERNAME}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json() as { key: string; returncode: number; message: string };
    
    if (data.returncode !== 0) {
      throw new Error(`ListTrac getKey failed: ${data.message}`);
    }
    
    return data.key;
  } catch (error) {
    console.error("[ListTrac] getKey() failed:", error);
    throw error;
  }
}

function generateToken(key: string): string {
  const combined = PASSWORD + key;
  return crypto.createHash("md5").update(combined).digest("hex");
}

async function getOrRefreshToken(): Promise<string> {
  const now = Date.now();
  
  // Return cached token if still valid
  if (cachedToken && now - cachedTokenTime < TOKEN_CACHE_TTL) {
    return cachedToken;
  }
  
  // Generate new token
  const key = await getKey();
  cachedToken = generateToken(key);
  cachedTokenTime = now;
  
  console.log(`[ListTrac] Generated new token (expires in ${TOKEN_CACHE_TTL / 1000 / 60} minutes)`);
  
  return cachedToken;
}

// ─── Metrics Pulling ────────────────────────────────────────────────────────
export interface ListTracMetrics {
  views: number;
  inquiries: number;
  shares: number;
  favorites: number;
  vTourViews: number;
  platformBreakdown: Record<string, { views: number; inquiries: number }>;
}

async function getListingMetrics(
  listingId: string,
  startDate: string,
  endDate: string
): Promise<ListTracMetrics> {
  const token = await getOrRefreshToken();
  
  const payload = {
    request: {
      token,
      viewtype: "listing",
      viewtypeID: listingId,
      metric: "view,inquiry,share,favorite,gallery,vtour",
      details: "true", // Enable per-listing breakdown
      startdate: startDate,
      enddate: endDate,
    },
  };
  
  try {
    console.log(`[ListTrac] Calling API with payload:`, { viewtype: payload.request.viewtype, viewtypeID: payload.request.viewtypeID, startdate: payload.request.startdate, enddate: payload.request.enddate });
    const response = await fetch(`${LISTTRAC_BASE_URL}/getmetricsbyorganization`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    
    console.log(`[ListTrac] API response status:`, response.status);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ListTrac API HTTP error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json() as {
      response?: {
        returncode: number;
        message: string;
        metrics?: {
          sites: Array<{
            sitename: string;
            sitetype?: string;
            dates: Array<{
              date: string;
              details: Array<{
                view?: string;
                inquiry?: string;
                share?: string;
                favorite?: string;
                gallery?: string;
                vtour?: string;
              }>;
            }>;
          }>;
        };
      };
    };
    
    console.log(`[ListTrac] API response data:`, { returncode: data.response?.returncode, message: data.response?.message, sitesCount: data.response?.metrics?.sites?.length });
    if (!data.response || data.response.returncode !== 0) {
      const errorMsg = data.response?.message || "Unknown error";
      throw new Error(`ListTrac API error: ${errorMsg}`);
    }
    
    // Aggregate metrics across all sites and dates
    let totalViews = 0;
    let totalInquiries = 0;
    let totalShares = 0;
    let totalFavorites = 0;
    let totalVTours = 0;
    const platformBreakdown: Record<string, { views: number; inquiries: number }> = {};
    
    if (data.response.metrics?.sites) {
      for (const site of data.response.metrics.sites) {
        const platformName = site.sitename || "Unknown";
        let platformViews = 0;
        let platformInquiries = 0;
        
        for (const dateEntry of site.dates) {
          for (const detail of dateEntry.details) {
            const views = parseInt(detail.view || "0", 10);
            const inquiries = parseInt(detail.inquiry || "0", 10);
            const shares = parseInt(detail.share || "0", 10);
            const favorites = parseInt(detail.favorite || "0", 10);
            const vTours = parseInt(detail.vtour || "0", 10);
            
            totalViews += views;
            totalInquiries += inquiries;
            totalShares += shares;
            totalFavorites += favorites;
            totalVTours += vTours;
            
            platformViews += views;
            platformInquiries += inquiries;
          }
        }
        
        // Store platform breakdown
        if (platformViews > 0 || platformInquiries > 0) {
          platformBreakdown[platformName] = {
            views: platformViews,
            inquiries: platformInquiries,
          };
        }
      }
    }
    
    return {
      views: totalViews,
      inquiries: totalInquiries,
      shares: totalShares,
      favorites: totalFavorites,
      vTourViews: totalVTours,
      platformBreakdown,
    };
  } catch (error) {
    console.error(`[ListTrac] getListingMetrics failed for listing ${listingId}:`, error);
    throw error;
  }
}

// ─── Sync Functions ─────────────────────────────────────────────────────────
export async function syncListingMetrics(listingId: number, daysBack: number = 7): Promise<void> {
  console.log(`[ListTrac] syncListingMetrics called for listing ${listingId}, daysBack=${daysBack}`);
  const db = await getDb();
  if (!db) {
    const err = "Database not available";
    console.error(`[ListTrac] ${err}`);
    throw new Error(err);
  }
  console.log(`[ListTrac] Database connected`);
  
  try {
    console.log(`[ListTrac] Fetching listing ${listingId}...`);
    // Get listing
    const listingRows = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
    const listing = listingRows[0];
    
    if (!listing) {
      throw new Error(`Listing ${listingId} not found`);
    }
    
    console.log(`[ListTrac] Found listing: ${listing.address}`);
    // Check if listing has a ListTrac ID (use MLS number)
    const listtracId = listing.mlsNumber;
    if (!listtracId) {
      console.warn(`[ListTrac] Listing ${listingId} has no MLS number, skipping`);
      return;
    }
    console.log(`[ListTrac] Using MLS number as ListTrac ID: ${listtracId}`);
    
    // Get metrics for the specified date range
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
    
    const startDateStr = startDate.toISOString().split("T")[0]!.replace(/-/g, "");
    const endDateStr = endDate.toISOString().split("T")[0]!.replace(/-/g, "");
    
    console.log(`[ListTrac] Fetching metrics from ${startDateStr} to ${endDateStr}...`);
    const metrics = await getListingMetrics(listtracId, startDateStr, endDateStr);
    console.log(`[ListTrac] Got metrics:`, metrics);
    
    console.log(`[ListTrac] Synced listing ${listing.address} (ID: ${listtracId}): ${metrics.views} views, ${metrics.inquiries} inquiries, ${metrics.shares} shares, ${metrics.favorites} favorites`);
    console.log(`[ListTrac] Saving to database...`);
    
    // Get or create weekly stats for this week
    const weekStart = new Date(endDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    const existingStatsRows = await db
      .select()
      .from(weeklyStats)
      .where(
        and(
          eq(weeklyStats.listingId, listingId),
          gte(weeklyStats.weekOf, weekStart),
          lte(weeklyStats.weekOf, weekEnd)
        )
      )
      .limit(1);
    const existingStats = existingStatsRows[0];
    
    if (existingStats) {
      console.log(`[ListTrac] Updating existing weekly stats record ${existingStats.id}`);
      // Update existing stats
      await db
        .update(weeklyStats)
        .set({
          listtracViews: metrics.views,
          listtracInquiries: metrics.inquiries,
          listtracShares: metrics.shares,
          listtracFavorites: metrics.favorites,
          listtracVTourViews: metrics.vTourViews,
          platformBreakdown: JSON.stringify(metrics.platformBreakdown),
          dateRangeStart: startDate,
          dateRangeEnd: endDate,
          updatedAt: new Date(),
        })
        .where(eq(weeklyStats.id, existingStats.id));
      console.log(`[ListTrac] ✓ Updated weekly stats`);
    } else {
      console.log(`[ListTrac] Creating new weekly stats record`);
      // Create new stats
      await db.insert(weeklyStats).values({
        listingId: listingId,
        weekOf: weekStart,
        listtracViews: metrics.views,
        listtracInquiries: metrics.inquiries,
        listtracShares: metrics.shares,
        listtracFavorites: metrics.favorites,
        listtracVTourViews: metrics.vTourViews,
        platformBreakdown: JSON.stringify(metrics.platformBreakdown),
        dateRangeStart: startDate,
        dateRangeEnd: endDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`[ListTrac] ✓ Created new weekly stats`);
    }
    
    // Log sync
    const logEntry: InsertListracSyncLog = {
      listingId,
      status: "success",
      viewsCount: metrics.views,
      inquiriesCount: metrics.inquiries,
      sharesCount: metrics.shares,
      favoritesCount: metrics.favorites,
      syncedAt: new Date(),
    };
    
    await db.insert(listracSyncLogs).values(logEntry);
  } catch (error) {
    console.error(`[ListTrac] syncListingMetrics failed for listing ${listingId}:`, error);
    
    // Log error
    const errorMsg = error instanceof Error ? error.message : String(error);
    const logEntry: InsertListracSyncLog = {
      listingId,
      status: "error",
      errorMessage: errorMsg,
      syncedAt: new Date(),
    };
    
    await db.insert(listracSyncLogs).values(logEntry);
    
    // Re-throw the error so tRPC mutation can surface it to the UI
    throw error;
  }
}

export async function syncAllListings(daysBack: number = 7): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[ListTrac] Cannot sync all: database not available");
    return;
  }
  
  try {
    const allListings = await db.select().from(listings);
    
    console.log(`[ListTrac] Starting sync for ${allListings.length} listings (${daysBack} days back)...`);
    
    for (const listing of allListings) {
      await syncListingMetrics(listing.id, daysBack);
      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    
    console.log("[ListTrac] Sync complete");
  } catch (error) {
    console.error("[ListTrac] syncAllListings failed:", error);
  }
}

// ─── Startup Test ───────────────────────────────────────────────────────────
export async function runListTracTestCall(): Promise<void> {
  try {
    console.log("[ListTrac] Running startup test call...");
    
    const key = await getKey();
    console.log(`[ListTrac] ✓ getKey() succeeded: ${key}`);
    
    const token = generateToken(key);
    console.log(`[ListTrac] ✓ Token generated: ${token.substring(0, 8)}...`);
    
    console.log("[ListTrac] ✓ Test call successful");
  } catch (error) {
    console.error("[ListTrac] ✗ Test call failed:", error);
  }
}
