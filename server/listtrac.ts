/**
 * ListTrac API Integration (Bulk Sync)
 * Fetches ALL listings from MLS 44890 and syncs their metrics
 * Pulls metrics: views, inquiries, shares, favorites, virtual tours
 * Includes platform-specific breakdown (Zillow, Realtor.com, Redfin, etc.)
 *
 * Flow:
 *   1. Get all listings from database
 *   2. Call getKey() → get GUID
 *   3. MD5(password + GUID) → get token
 *   4. For each listing, call GetMetricsByOrganization with MLS number
 *   5. Parse response: aggregate metrics + platform breakdown
 *   6. Upsert into weekly_stats with listingId
 */

import crypto from "crypto";
import { getDb } from "./db";
import {
  listings,
  weeklyStats,
} from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

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
export interface ListingMetricsData {
  views: number;
  inquiries: number;
  shares: number;
  favorites: number;
  vTourViews: number;
  platformBreakdown: Record<string, { views: number; inquiries: number }>;
}

async function getListingMetrics(
  token: string,
  mlsNumber: string,
  startDate: string,
  endDate: string
): Promise<ListingMetricsData> {
  const payload = {
    request: {
      token,
      viewtype: "listing",
      viewtypeID: mlsNumber,
      metric: "view,inquiry,share,favorite,vtour",
      details: "true",
      startdate: startDate,
      enddate: endDate,
    },
  };
  
  try {
    console.log(`[ListTrac] Fetching metrics for MLS ${mlsNumber}`);
    const response = await fetch(`${LISTTRAC_BASE_URL}/getmetricsbyorganization`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ListTrac API HTTP error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json() as {
      response?: {
        returncode: number;
        message: string;
        metrics?: {
          sites?: Array<{
            sitename: string;
            dates?: Array<{
              details?: Array<{
                view?: string | number;
                inquiry?: string | number;
                share?: string | number;
                favorite?: string | number;
                vtour?: string | number;
              }>;
            }>;
          }>;
        };
      };
    };
    
    if (!data.response || data.response.returncode !== 0) {
      const errorMsg = data.response?.message || "Unknown error";
      throw new Error(`ListTrac API error: ${errorMsg}`);
    }
    
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
        
        if (site.dates) {
          for (const dateEntry of site.dates) {
            if (dateEntry.details) {
              for (const detail of dateEntry.details) {
                const views = parseInt(String(detail.view || "0"), 10) || 0;
                const inquiries = parseInt(String(detail.inquiry || "0"), 10) || 0;
                const shares = parseInt(String(detail.share || "0"), 10) || 0;
                const favorites = parseInt(String(detail.favorite || "0"), 10) || 0;
                const vTours = parseInt(String(detail.vtour || "0"), 10) || 0;
                
                totalViews += views;
                totalInquiries += inquiries;
                totalShares += shares;
                totalFavorites += favorites;
                totalVTours += vTours;
                
                platformViews += views;
                platformInquiries += inquiries;
              }
            }
          }
        }
        
        if (platformViews > 0 || platformInquiries > 0) {
          platformBreakdown[platformName] = {
            views: platformViews,
            inquiries: platformInquiries,
          };
        }
      }
    }
    
    console.log(`[ListTrac] Got metrics for MLS ${mlsNumber}: ${totalViews} views, ${totalInquiries} inquiries`);
    
    return {
      views: totalViews,
      inquiries: totalInquiries,
      shares: totalShares,
      favorites: totalFavorites,
      vTourViews: totalVTours,
      platformBreakdown,
    };
  } catch (error) {
    console.error(`[ListTrac] Failed to fetch metrics for MLS ${mlsNumber}:`, error);
    throw error;
  }
}

// ─── Sync Functions ─────────────────────────────────────────────────────────
export async function syncAllListingsFromMLS(daysBack: number = 7): Promise<{ success: boolean; listingsUpdated: number }> {
  console.log(`[ListTrac] Starting bulk sync for MLS ${USERNAME} (last ${daysBack} days)`);
  
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  
  try {
    const token = await getOrRefreshToken();
    
    // Get all listings from database
    const allListings = await db.select().from(listings);
    console.log(`[ListTrac] Found ${allListings.length} listings in database`);
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
    
    const startDateStr = startDate.toISOString().split("T")[0]!.replace(/-/g, "");
    const endDateStr = endDate.toISOString().split("T")[0]!.replace(/-/g, "");
    
    console.log(`[ListTrac] Fetching metrics from ${startDateStr} to ${endDateStr}`);
    
    // Get week start date
    const weekOf = new Date();
    weekOf.setDate(weekOf.getDate() - weekOf.getDay()); // Start of week (Sunday)
    weekOf.setHours(0, 0, 0, 0);
    
    let listingsUpdated = 0;
    
    // Sync each listing
    for (const listing of allListings) {
      if (!listing.mlsNumber) {
        console.warn(`[ListTrac] Listing ${listing.id} has no MLS number, skipping`);
        continue;
      }
      
      try {
        console.log(`[ListTrac] Syncing listing ${listing.id} (MLS ${listing.mlsNumber})`);
        
        const metrics = await getListingMetrics(token, listing.mlsNumber, startDateStr, endDateStr);
        
        // Check if record exists for this week
        const existing = await db
          .select()
          .from(weeklyStats)
          .where(
            and(
              eq(weeklyStats.listingId, listing.id),
              eq(weeklyStats.weekOf, weekOf)
            )
          )
          .limit(1);
        
        if (existing.length > 0) {
          // Update existing record
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
            .where(eq(weeklyStats.id, existing[0].id));
          console.log(`[ListTrac] Updated existing stats for listing ${listing.id}`);
        } else {
          // Insert new record
          await db.insert(weeklyStats).values({
            listingId: listing.id,
            weekOf: weekOf,
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
          console.log(`[ListTrac] Created new stats for listing ${listing.id}`);
        }
        
        listingsUpdated++;
        
        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[ListTrac] Failed to sync listing ${listing.id}:`, error);
        // Continue with next listing on error
      }
    }
    
    console.log(`[ListTrac] Bulk sync completed: ${listingsUpdated} listings updated`);
    return { success: true, listingsUpdated };
  } catch (error) {
    console.error("[ListTrac] Bulk sync failed:", error);
    throw error;
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
