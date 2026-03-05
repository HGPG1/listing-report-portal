/**
 * Zillow Reporting API Integration
 * OAuth 1.0a (HMAC-SHA1) — Consumer Key/Secret + Token/Token Secret
 *
 * Flow:
 *   1. GET /1.0/feeds/  → discover feedId for Canopy MLS
 *   2. GET /1.0/feeds/:feedId/listings/:mlsNumber  → per-listing stats (7-day window)
 *   3. Upsert zillowViews into weekly_stats for the current week
 *   4. Log result in zillow_sync_logs
 *
 * Auth fallback: tries tokenSecret = "none" first, then "" (empty string).
 * All HTTP errors are logged with full status + body for debugging.
 */

import crypto from "crypto";
import { getDb } from "./db";
import {
  listings,
  weeklyStats,
  zillowSyncLogs,
  InsertZillowSyncLog,
} from "../drizzle/schema";
import { eq, and, gte, lte } from "drizzle-orm";

// ─── Credentials ─────────────────────────────────────────────────────────────
const ZILLOW_BASE_URL = "https://reporting-api.zillowgroup.com";
const CONSUMER_KEY = process.env.ZILLOW_CONSUMER_KEY ?? "";
const CONSUMER_SECRET = process.env.ZILLOW_CONSUMER_SECRET ?? "";
const TOKEN = process.env.ZILLOW_TOKEN ?? "829BA1C84595469AA396BA00DFDB728F";
// Token secret: try "" first, then "none" as fallback
const TOKEN_SECRET_PRIMARY = process.env.ZILLOW_TOKEN_SECRET ?? "";
const TOKEN_SECRET_FALLBACK = "none"; // Fallback to try 'none'

// Cached feed ID (discovered on first call)
let cachedFeedId: number | null = null;

// ─── OAuth 1.0a Signature ────────────────────────────────────────────────────
function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

function buildOAuthHeader(
  method: string,
  url: string,
  queryParams: Record<string, string>,
  tokenSecret: string
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: TOKEN,
    oauth_version: "1.0",
  };

  // Parse URL to get base URL without query string
  const urlObj = new URL(url);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;

  // Combine oauth params + query params for signature base (all params, sorted)
  const allParams: Record<string, string> = { ...queryParams, ...oauthParams };
  const sortedParams = Object.keys(allParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join("&");

  const signatureBase = [
    method.toUpperCase(),
    percentEncode(baseUrl),
    percentEncode(sortedParams),
  ].join("&");

  // OAuth 1.0a signing key: consumer_secret&token_secret (both percent-encoded)
  const signingKey = `${percentEncode(CONSUMER_SECRET)}&${percentEncode(tokenSecret)}`;
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(signatureBase)
    .digest("base64");

  console.log(`[Zillow OAuth Debug]`);
  console.log(`  Method: ${method}`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Query Params: ${JSON.stringify(queryParams)}`);
  console.log(`  Timestamp: ${timestamp}`);
  console.log(`  Token Secret: "${tokenSecret}"`);
  console.log(`  Signing Key: ${signingKey}`);
  console.log(`  Signature Base: ${signatureBase}`);
  console.log(`  Generated Signature: ${signature}`);

  oauthParams["oauth_signature"] = signature;

  const headerValue =
    "OAuth " +
    Object.keys(oauthParams)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
      .join(", ");

  console.log(`[Zillow OAuth Header] ${headerValue.substring(0, 100)}...`);

  return headerValue;
}

// ─── HTTP Helper ─────────────────────────────────────────────────────────────
async function zillowGet(
  path: string,
  queryParams: Record<string, string> = {},
  tokenSecret: string
): Promise<{ ok: boolean; status: number; body: string; data: any }> {
  const baseUrl = `${ZILLOW_BASE_URL}${path}`;
  const qs = new URLSearchParams(queryParams).toString();
  const fullUrl = `${baseUrl}${qs ? "?" + qs : ""}`;

  // Build OAuth header with the base URL (without query string)
  const authHeader = buildOAuthHeader("GET", baseUrl, queryParams, tokenSecret);

  let status = 0;
  let body = "";
  try {
    const res = await fetch(fullUrl, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
    });
    status = res.status;
    body = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(body);
    } catch {}
    return { ok: res.ok, status, body, data };
  } catch (err: any) {
    return { ok: false, status: 0, body: err.message, data: null };
  }
}

// ─── Feed Discovery ───────────────────────────────────────────────────────────
export async function discoverFeedId(tokenSecret = TOKEN_SECRET_PRIMARY): Promise<{
  feedId: number | null;
  error?: string;
  httpStatus?: number;
  responseBody?: string;
}> {
  if (cachedFeedId !== null) {
    return { feedId: cachedFeedId };
  }

  console.log("[Zillow] Discovering feed ID from /1.0/feeds/ ...");
  const result = await zillowGet("/1.0/feeds/", {}, tokenSecret);

  if (!result.ok) {
    // Try fallback token secret
    if (tokenSecret !== TOKEN_SECRET_FALLBACK) {
      console.log(`[Zillow] Feed discovery failed with tokenSecret="${tokenSecret}" (HTTP ${result.status}), retrying with empty string...`);
      return discoverFeedId(TOKEN_SECRET_FALLBACK);
    }
    console.error(`[Zillow] Feed discovery failed: HTTP ${result.status} — ${result.body}`);
    return {
      feedId: null,
      error: `HTTP ${result.status}: ${result.body.slice(0, 500)}`,
      httpStatus: result.status,
      responseBody: result.body,
    };
  }

  const feeds: Array<{ feedId: number; name: string }> = result.data?.feeds ?? [];
  console.log(`[Zillow] Available feeds: ${JSON.stringify(feeds.map((f) => ({ id: f.feedId, name: f.name })))}`);

  // Find Canopy MLS feed (case-insensitive match)
  const canopy = feeds.find(
    (f) =>
      f.name?.toLowerCase().includes("canopy") ||
      f.name?.toLowerCase().includes("carolina")
  );
  const feedId = canopy?.feedId ?? feeds[0]?.feedId ?? null;

  if (feedId) {
    cachedFeedId = feedId;
    console.log(`[Zillow] Using feedId: ${feedId} (${canopy?.name ?? feeds[0]?.name ?? "first available"})`);
  } else {
    console.warn("[Zillow] No feeds found in response:", result.body.slice(0, 500));
  }

  return { feedId };
}

// ─── Per-Listing Sync ─────────────────────────────────────────────────────────
export interface ZillowSyncResult {
  listingId: number;
  mlsNumber: string;
  status: "success" | "failed" | "skipped";
  views?: number;
  impressions?: number;
  contacts?: number;
  error?: string;
  httpStatus?: number;
  tokenSecretUsed?: string;
}

export async function syncZillowListing(
  listingId: number,
  mlsNumber: string,
  feedId: number
): Promise<ZillowSyncResult> {
  // Build 7-day window ending yesterday (data is ~2 days behind)
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const queryParams = {
    startDate: fmt(startDate),
    endDate: fmt(endDate),
    dataSource: "zillow",
  };

  const path = `/1.0/feeds/${feedId}/listings/${mlsNumber}`;

  // Try primary token secret first
  let result = await zillowGet(path, queryParams, TOKEN_SECRET_PRIMARY);
  let tokenSecretUsed = TOKEN_SECRET_PRIMARY;

  if (!result.ok && TOKEN_SECRET_PRIMARY !== TOKEN_SECRET_FALLBACK) {
    console.log(`[Zillow] Listing ${mlsNumber} failed with tokenSecret="${TOKEN_SECRET_PRIMARY}" (HTTP ${result.status}), retrying with empty string...`);
    result = await zillowGet(path, queryParams, TOKEN_SECRET_FALLBACK);
    tokenSecretUsed = TOKEN_SECRET_FALLBACK;
  }

  const db = await getDb();

  if (!result.ok) {
    const errMsg = `HTTP ${result.status}: ${result.body.slice(0, 500)}`;
    console.error(`[Zillow] ✗ Listing ${mlsNumber} (listing #${listingId}): ${errMsg}`);

    // Log failure
    if (db) {
      await db.insert(zillowSyncLogs).values({
        listingId,
        mlsNumber,
        feedId,
        status: "failed",
        errorMessage: errMsg,
        httpStatus: result.status,
        responseBody: result.body.slice(0, 2000),
        tokenSecretUsed,
      });
    }

    return {
      listingId,
      mlsNumber,
      status: "failed",
      error: errMsg,
      httpStatus: result.status,
      tokenSecretUsed,
    };
  }

  // Extract summary totals
  const summary = result.data?.summary ?? {};
  const views: number = summary.views ?? 0;
  const impressions: number = summary.impressions ?? 0;
  const contacts: number = summary.contacts ?? 0;

  console.log(`[Zillow] ✓ Listing ${mlsNumber}: views=${views}, impressions=${impressions}, contacts=${contacts} (tokenSecret="${tokenSecretUsed}")`);

  // Upsert into weekly_stats for current week (Monday)
  if (db) {
    const monday = getMondayOfCurrentWeek();
    const nextMonday = new Date(monday);
    nextMonday.setDate(nextMonday.getDate() + 7);

    // Check if a weekly stat row exists for this listing + week
    const existing = await db
      .select()
      .from(weeklyStats)
      .where(
        and(
          eq(weeklyStats.listingId, listingId),
          gte(weeklyStats.weekOf, monday),
          lte(weeklyStats.weekOf, nextMonday)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(weeklyStats)
        .set({ zillowViews: views })
        .where(eq(weeklyStats.id, existing[0].id));
    } else {
      await db.insert(weeklyStats).values({
        listingId,
        weekOf: monday,
        zillowViews: views,
        realtorViews: 0,
        redfinViews: 0,
        websiteViews: 0,
        totalImpressions: impressions,
        totalVideoViews: 0,
        totalShowings: 0,
      });
    }

    // Log success
    await db.insert(zillowSyncLogs).values({
      listingId,
      mlsNumber,
      feedId,
      status: "success",
      zillowViews: views,
      zillowImpressions: impressions,
      zillowContacts: contacts,
      tokenSecretUsed,
    });
  }

  return { listingId, mlsNumber, status: "success", views, impressions, contacts, tokenSecretUsed };
}

// ─── Sync All Active Listings ─────────────────────────────────────────────────
export async function syncAllZillowListings(): Promise<{
  processed: number;
  skipped: number;
  errors: number;
  results: ZillowSyncResult[];
  feedId: number | null;
  feedError?: string;
}> {
  console.log("[Zillow] Starting full sync...");

  // Step 1: Discover feed ID
  const { feedId, error: feedError, httpStatus, responseBody } = await discoverFeedId();

  if (!feedId) {
    console.error("[Zillow] Cannot sync — feed discovery failed:", feedError);
    return { processed: 0, skipped: 0, errors: 1, results: [], feedId: null, feedError };
  }

  // Step 2: Get all active listings with MLS numbers
  const db = await getDb();
  if (!db) {
    return { processed: 0, skipped: 0, errors: 1, results: [], feedId, feedError: "Database unavailable" };
  }

  const activeListings = await db
    .select({ id: listings.id, mlsNumber: listings.mlsNumber, address: listings.address })
    .from(listings)
    .where(eq(listings.status, "Active"));

  console.log(`[Zillow] Found ${activeListings.length} active listings`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  const results: ZillowSyncResult[] = [];

  for (const listing of activeListings) {
    if (!listing.mlsNumber) {
      console.log(`[Zillow] Skipping listing #${listing.id} (${listing.address}) — no MLS number`);
      skipped++;
      results.push({ listingId: listing.id, mlsNumber: "", status: "skipped" });

      // Log skip
      await db.insert(zillowSyncLogs).values({
        listingId: listing.id,
        mlsNumber: null,
        feedId,
        status: "skipped",
        errorMessage: "No MLS number entered",
      });
      continue;
    }

    const result = await syncZillowListing(listing.id, listing.mlsNumber, feedId);
    results.push(result);

    if (result.status === "success") processed++;
    else if (result.status === "failed") errors++;
  }

  console.log(`[Zillow] Sync complete. Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`);
  return { processed, skipped, errors, results, feedId };
}

// ─── Get Recent Sync Logs ─────────────────────────────────────────────────────
export async function getZillowSyncLogs(listingId?: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];

  const query = db
    .select()
    .from(zillowSyncLogs)
    .orderBy(zillowSyncLogs.syncedAt)
    .limit(limit);

  if (listingId !== undefined) {
    return db
      .select()
      .from(zillowSyncLogs)
      .where(eq(zillowSyncLogs.listingId, listingId))
      .orderBy(zillowSyncLogs.syncedAt)
      .limit(limit);
  }

  return query;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getMondayOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// ─── Startup Test Call ────────────────────────────────────────────────────────
export async function runZillowTestCall(): Promise<void> {
  console.log("[Zillow] Running startup test call to /1.0/feeds/ ...");
  const { feedId, error } = await discoverFeedId();
  if (feedId) {
    console.log(`[Zillow] ✓ Test call successful. Feed ID: ${feedId}`);
  } else {
    console.error(`[Zillow] ✗ Test call failed: ${error}`);
    console.error("[Zillow] Check ZILLOW_TOKEN, ZILLOW_CONSUMER_KEY, and OAuth signature generation.");
  }
}
