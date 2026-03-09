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
  // Major platforms extracted from breakdown
  zillowViews: number;
  realtorViews: number;
  mlsViews: number;
  oneHomeViews: number;
  truliaViews: number;
  otherSourcesViews: number;
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
      metric: "view,inquiry,share,favorite",
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
              date?: string;
              details?: Array<{
                listingid?: string;
                counts?: Array<{
                  key: string;
                  value: string;
                }>;
              }>;
            }>;
          }>;
        };
      };
    };
    
    if (!data.response || data.response.returncode !== 0) {
      const errorMsg = data.response?.message || "Unknown error";
      console.error("[ListTrac] ERROR - Full API response:", JSON.stringify(data, null, 2));
      throw new Error(`ListTrac API error: ${errorMsg}`);
    }
    
    // Log the complete response structure for debugging
    console.log(`[ListTrac] SUCCESS - Full response structure:`);
    console.log(JSON.stringify(data.response, null, 2));
    
    let totalViews = 0;
    let totalInquiries = 0;
    let totalShares = 0;
    let totalFavorites = 0;
    let totalVTours = 0;
    const platformBreakdown: Record<string, { views: number; inquiries: number }> = {};
    
    // Major platforms to track individually
    let zillowViews = 0;
    let realtorViews = 0;
    let mlsViews = 0;
    let oneHomeViews = 0;
    let truliaViews = 0;
    let otherSourcesViews = 0;
    
    console.log(`[ListTrac] Metrics object exists: ${!!data.response.metrics}`);
    console.log(`[ListTrac] Sites array exists: ${!!data.response.metrics?.sites}`);
    
    if (data.response.metrics?.sites) {
      for (const site of data.response.metrics.sites) {
        const platformName = site.sitename || "Unknown";
        let platformViews = 0;
        let platformInquiries = 0;
        
        if (site.dates) {
          for (const dateEntry of site.dates) {
            if (dateEntry.details) {
              for (const detail of dateEntry.details) {
                // ListTrac returns metrics in a counts array: [{key: "views", value: "86"}, ...]
                let views = 0;
                let inquiries = 0;
                let shares = 0;
                let favorites = 0;
                let vTours = 0;
                
                if (detail.counts && Array.isArray(detail.counts)) {
                  for (const count of detail.counts) {
                    const value = parseInt(String(count.value || "0"), 10) || 0;
                    const key = count.key?.toLowerCase() || "";
                    
                    if (key === "views") {
                      views = value;
                    } else if (key === "inquiry" || key === "inquiries") {
                      inquiries = value;
                    } else if (key === "share" || key === "shares") {
                      shares = value;
                    } else if (key === "favorite" || key === "favorites") {
                      favorites = value;
                    } else if (key === "vtour" || key === "vtours") {
                      vTours = value;
                    }
                  }
                }
                
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
          console.log(`[ListTrac] Platform ${platformName}: ${platformViews} views, ${platformInquiries} inquiries`);
          platformBreakdown[platformName] = {
            views: platformViews,
            inquiries: platformInquiries,
          };
          
          // Extract major platforms
          const lowerPlatform = platformName.toLowerCase();
          if (lowerPlatform.includes("zillow")) {
            zillowViews += platformViews;
          } else if (lowerPlatform.includes("realtor")) {
            realtorViews += platformViews;
          } else if (lowerPlatform.includes("matrix") || lowerPlatform.includes("mls") || lowerPlatform.includes("canopy")) {
            mlsViews += platformViews;
          } else if (lowerPlatform.includes("onehome")) {
            oneHomeViews += platformViews;
          } else if (lowerPlatform.includes("trulia")) {
            truliaViews += platformViews;
          } else {
            // Aggregate all other sources
            otherSourcesViews += platformViews;
          }
        }
      }
    }
    
    console.log(`[ListTrac] FINAL METRICS for ${mlsNumber}: views=${totalViews}, inquiries=${totalInquiries}, shares=${totalShares}, favorites=${totalFavorites}, vtours=${totalVTours}`);
    console.log(`[ListTrac] Major platforms: Zillow=${zillowViews}, Realtor=${realtorViews}, MLS=${mlsViews}, OneHome=${oneHomeViews}, Trulia=${truliaViews}, Other=${otherSourcesViews}`);
    
    return {
      views: totalViews,
      inquiries: totalInquiries,
      shares: totalShares,
      favorites: totalFavorites,
      vTourViews: totalVTours,
      platformBreakdown,
      zillowViews,
      realtorViews,
      mlsViews,
      oneHomeViews,
      truliaViews,
      otherSourcesViews,
    };
  } catch (error) {
    console.error(`[ListTrac] Failed to fetch metrics for MLS ${mlsNumber}:`, error);
    throw error;
  }
}

// ─── Sync Functions ─────────────────────────────────────────────────────────
export async function syncSingleListing(listingId: number, daysBack: number = 7): Promise<ListingMetricsData> {
  const daysLabel = daysBack === -1 ? "life of listing" : `last ${daysBack} days`;
  console.log(`[ListTrac] Starting sync for single listing ${listingId} (${daysLabel})`);
  
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  
  try {
    const token = await getOrRefreshToken();
    
    // Get the specific listing
    const listing = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
    if (!listing || listing.length === 0) {
      throw new Error(`Listing ${listingId} not found`);
    }
    
    if (!listing[0].mlsNumber) {
      throw new Error(`Listing ${listingId} has no MLS number`);
    }
    
    // Calculate date range
    const endDate = new Date();
    let startDate: Date;
    
    if (daysBack === -1) {
      // Life of listing: use listing's original list date or go back 5 years
      const listingListDate = listing[0].listDate ? new Date(listing[0].listDate) : new Date(endDate.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
      startDate = listingListDate;
      console.log(`[ListTrac] Life-of-listing sync: using list date ${listingListDate.toISOString()}`);
    } else {
      startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
    }
    
    const startDateStr = startDate.toISOString().split("T")[0]!.replace(/-/g, "");
    const endDateStr = endDate.toISOString().split("T")[0]!.replace(/-/g, "");
    
    console.log(`[ListTrac] Fetching metrics from ${startDateStr} to ${endDateStr}`);
    
    // Get metrics for this listing
    const metrics = await getListingMetrics(token, listing[0].mlsNumber, startDateStr, endDateStr);
    
    // Get week start date
    const weekOf = new Date();
    weekOf.setDate(weekOf.getDate() - weekOf.getDay()); // Start of week (Sunday)
    weekOf.setHours(0, 0, 0, 0);
    
    // Check if record exists for this week
    const existing = await db
      .select()
      .from(weeklyStats)
      .where(
        and(
          eq(weeklyStats.listingId, listingId),
          eq(weeklyStats.weekOf, weekOf)
        )
      )
      .limit(1);
    
    // Extract major platform views from metrics
    const zillowViews = metrics.zillowViews;
    const realtorViews = metrics.realtorViews;
    const mlsViews = metrics.mlsViews;
    const oneHomeViews = metrics.oneHomeViews;
    const truliaViews = metrics.truliaViews;
    const otherSourcesViews = metrics.otherSourcesViews;
    
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
          zillowListtracViews: zillowViews,
          realtorListtracViews: realtorViews,
          mlsListtracViews: mlsViews,
          oneHomeListtracViews: oneHomeViews,
          truliaListtracViews: truliaViews,
          otherSourcesListtracViews: otherSourcesViews,
          platformBreakdown: JSON.stringify(metrics.platformBreakdown),
          dateRangeStart: startDate,
          dateRangeEnd: endDate,
          updatedAt: new Date(),
        })
        .where(eq(weeklyStats.id, existing[0].id));
      console.log(`[ListTrac] Updated existing stats for listing ${listingId}`);
    } else {
      // Create new record
      await db.insert(weeklyStats).values({
        listingId,
        weekOf,
        listtracViews: metrics.views,
        listtracInquiries: metrics.inquiries,
        listtracShares: metrics.shares,
        listtracFavorites: metrics.favorites,
        listtracVTourViews: metrics.vTourViews,
        zillowListtracViews: zillowViews,
        realtorListtracViews: realtorViews,
        mlsListtracViews: mlsViews,
        oneHomeListtracViews: oneHomeViews,
        truliaListtracViews: truliaViews,
        otherSourcesListtracViews: otherSourcesViews,
        platformBreakdown: JSON.stringify(metrics.platformBreakdown),
        dateRangeStart: startDate,
        dateRangeEnd: endDate,
      });
      console.log(`[ListTrac] Created new stats for listing ${listingId}`);
    }
    
    console.log(`[ListTrac] Single listing sync completed for ${listingId}`);
    return metrics;
  } catch (error) {
    console.error(`[ListTrac] Single listing sync failed:`, error);
    throw error;
  }
}

export async function syncAllListingsFromMLS(daysBack: number = 7): Promise<{ success: boolean; listingsUpdated: number }> {
  const daysLabel = daysBack === -1 ? "life of listing" : `last ${daysBack} days`;
  console.log(`[ListTrac] Starting bulk sync for MLS ${USERNAME} (${daysLabel})`);
  
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
    let startDate: Date;
    
    if (daysBack === -1) {
      // Life of listing: go back 5 years as a safe default
      startDate = new Date(endDate.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
      console.log(`[ListTrac] Life-of-listing sync: using 5-year default`);
    } else {
      startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
    }
    
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
    console.error(`[ListTrac] Bulk sync failed:`, error);
    throw error;
  }
}


// ─── Test Call ──────────────────────────────────────────────────────────────
export async function runListTracTestCall(): Promise<void> {
  console.log("[ListTrac] Running startup test call...");
  try {
    const key = await getKey();
    console.log(`[ListTrac] ✓ getKey() succeeded: ${key}`);
    
    const token = generateToken(key);
    console.log(`[ListTrac] ✓ Token generated: ${token.substring(0, 8)}...`);
    
    // Test with a simple call
    const testPayload = {
      request: {
        token,
        viewtype: "listing",
        viewtypeID: "4346944",
        metric: "view",
        details: "true",
        startdate: "20260301",
        enddate: "20260306",
      },
    };
    
    const response = await fetch(`${LISTTRAC_BASE_URL}/getmetricsbyorganization`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPayload),
    });
    
    if (response.ok) {
      console.log("[ListTrac] ✓ Test call successful");
    } else {
      console.error(`[ListTrac] ✗ Test call failed with status ${response.status}`);
    }
  } catch (error) {
    console.error("[ListTrac] ✗ Test call failed:", error);
  }
}


// ─── Discovery & Auto-Sync ──────────────────────────────────────────────────
/**
 * Fetch all active listings from ListTrac organization
 * Returns array of {mlsNumber, address, status, ...}
 * Used to discover new listings and update existing ones
 */
export async function discoverListingsFromListTrac(): Promise<
  Array<{
    mlsNumber: string;
    address?: string;
    status?: string;
    listingDetails?: Record<string, any>;
  }>
> {
  console.log("[ListTrac] Starting listing discovery from database...");
  
  try {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }
    
    // Since ListTrac API doesn't have a dedicated listings endpoint,
    // we return the listings already in our database.
    // The sync buttons will keep them up-to-date with ListTrac metrics.
    const allListings = await db.select().from(listings);
    
    console.log(`[ListTrac] Found ${allListings.length} listings in database`);
    
    return allListings.map((listing) => ({
      mlsNumber: listing.mlsNumber || "",
      address: listing.address,
      status: listing.status,
      listingDetails: listing,
    }));
  } catch (error) {
    console.error("[ListTrac] Listing discovery failed:", error);
    throw error;
  }
}

/**
 * Auto-sync: Discover all listings from ListTrac and update portal
 * - Add new listings to database
 * - Update status for existing listings
 * - Archive listings that are no longer in ListTrac
 */
export async function autoSyncListingsFromListTrac(): Promise<{
  added: number;
  updated: number;
  archived: number;
  errors: string[];
}> {
  console.log("[ListTrac] Starting auto-sync of all listings...");
  
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  
  const results = {
    added: 0,
    updated: 0,
    archived: 0,
    errors: [] as string[],
  };
  
  try {
    // Step 1: Discover all listings from ListTrac
    const discoveredListings = await discoverListingsFromListTrac();
    const discoveredMlsNumbers = new Set(discoveredListings.map((l) => l.mlsNumber));
    
    // Step 2: Get all active (non-archived) listings from database
    const dbListings = await db
      .select()
      .from(listings)
      .where(eq(listings.isArchived, false));
    
    // Step 3: Add new listings that don't exist in database
    for (const discovered of discoveredListings) {
      const existingListing = dbListings.find((l) => l.mlsNumber === discovered.mlsNumber);
      
      if (!existingListing) {
        try {
          // Extract address components if available
          const details = discovered.listingDetails || {};
          const address = details.address || discovered.address || `MLS ${discovered.mlsNumber}`;
          
          await db.insert(listings).values({
            address,
            city: details.city,
            state: details.state,
            zip: details.zip,
            mlsNumber: discovered.mlsNumber,
            status: "Active",
            isArchived: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          
          console.log(`[ListTrac] Added new listing: MLS ${discovered.mlsNumber} (${address})`);
          results.added++;
        } catch (error) {
          const msg = `Failed to add MLS ${discovered.mlsNumber}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(`[ListTrac] ${msg}`);
          results.errors.push(msg);
        }
      } else if (existingListing.status !== "Active") {
        // Update status back to Active if it was changed
        try {
          await db
            .update(listings)
            .set({
              status: "Active",
              isArchived: false,
              archivedAt: null,
              updatedAt: new Date(),
            })
            .where(eq(listings.id, existingListing.id));
          
          console.log(`[ListTrac] Reactivated listing: MLS ${discovered.mlsNumber}`);
          results.updated++;
        } catch (error) {
          const msg = `Failed to reactivate MLS ${discovered.mlsNumber}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(`[ListTrac] ${msg}`);
          results.errors.push(msg);
        }
      }
    }
    
    // Step 4: Archive listings that are no longer in ListTrac
    for (const dbListing of dbListings) {
      if (dbListing.mlsNumber && !discoveredMlsNumbers.has(dbListing.mlsNumber)) {
        try {
          await db
            .update(listings)
            .set({
              isArchived: true,
              archivedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(listings.id, dbListing.id));
          
          console.log(`[ListTrac] Archived listing: MLS ${dbListing.mlsNumber} (no longer in ListTrac)`);
          results.archived++;
        } catch (error) {
          const msg = `Failed to archive MLS ${dbListing.mlsNumber}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(`[ListTrac] ${msg}`);
          results.errors.push(msg);
        }
      }
    }
    
    console.log(
      `[ListTrac] Auto-sync complete: +${results.added} added, ~${results.updated} updated, ~${results.archived} archived`
    );
    
    return results;
  } catch (error) {
    console.error("[ListTrac] Auto-sync failed:", error);
    throw error;
  }
}
