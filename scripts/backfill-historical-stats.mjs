#!/usr/bin/env node

/**
 * Backfill Historical Weekly Stats
 * 
 * For each active/under contract listing, generates weekly records from list date to today
 * by calling ListTrac API for each week period and storing cumulative data
 */

import crypto from "crypto";
import mysql from "mysql2/promise";

// ─── Config ─────────────────────────────────────────────────────────────────
const LISTTRAC_BASE_URL = "https://b2b.listtrac.com/api";
const ORG_ID = process.env.LISTTRAC_ORG_ID ?? "canopy";
const USERNAME = process.env.LISTTRAC_USERNAME ?? "44890";
const PASSWORD = process.env.LISTTRAC_PASSWORD ?? "HomeGrown2026!";

let cachedToken = null;
let cachedTokenTime = 0;
const TOKEN_CACHE_TTL = 3600000; // 1 hour

// ─── Database Connection ────────────────────────────────────────────────────
async function getDbConnection() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  return connection;
}

// ─── ListTrac Token ─────────────────────────────────────────────────────────
async function getKey() {
  const url = `${LISTTRAC_BASE_URL}/getkey?orgID=${ORG_ID}&username=${USERNAME}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.returncode !== 0) throw new Error(`ListTrac getKey failed: ${data.message}`);
  return data.key;
}

function generateToken(key) {
  const combined = PASSWORD + key;
  return crypto.createHash("md5").update(combined).digest("hex");
}

async function getOrRefreshToken() {
  const now = Date.now();
  if (cachedToken && now - cachedTokenTime < TOKEN_CACHE_TTL) {
    return cachedToken;
  }
  const key = await getKey();
  cachedToken = generateToken(key);
  cachedTokenTime = now;
  console.log(`[Token] Generated new token`);
  return cachedToken;
}

// ─── ListTrac Metrics ───────────────────────────────────────────────────────
async function getListingMetrics(token, mlsNumber, startDate, endDate) {
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

  const response = await fetch(`${LISTTRAC_BASE_URL}/getmetricsbyorganization`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`ListTrac API HTTP error ${response.status}`);
  }

  const data = await response.json();
  if (!data.response || data.response.returncode !== 0) {
    throw new Error(`ListTrac API error: ${data.response?.message || "Unknown"}`);
  }

  // Parse metrics
  let totalViews = 0;
  let totalInquiries = 0;
  let totalShares = 0;
  let totalFavorites = 0;
  let totalVTours = 0;
  let zillowViews = 0;
  let realtorViews = 0;
  let mlsViews = 0;
  let oneHomeViews = 0;
  let truliaViews = 0;
  let otherSourcesViews = 0;
  const platformBreakdown = {};

  if (data.response.metrics?.sites) {
    for (const site of data.response.metrics.sites) {
      const platformName = site.sitename || "Unknown";
      let platformViews = 0;
      let platformInquiries = 0;

      if (site.dates) {
        for (const dateEntry of site.dates) {
          if (dateEntry.details) {
            for (const detail of dateEntry.details) {
              let views = 0;
              let inquiries = 0;
              let shares = 0;
              let favorites = 0;
              let vTours = 0;

              if (detail.counts && Array.isArray(detail.counts)) {
                for (const count of detail.counts) {
                  const value = parseInt(String(count.value || "0"), 10) || 0;
                  const key = count.key?.toLowerCase() || "";

                  if (key === "views") views = value;
                  else if (key === "inquiry" || key === "inquiries") inquiries = value;
                  else if (key === "share" || key === "shares") shares = value;
                  else if (key === "favorite" || key === "favorites") favorites = value;
                  else if (key === "vtour" || key === "vtours") vTours = value;
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
        platformBreakdown[platformName] = { views: platformViews, inquiries: platformInquiries };

        const lowerPlatform = platformName.toLowerCase();
        if (lowerPlatform.includes("zillow")) zillowViews += platformViews;
        else if (lowerPlatform.includes("realtor")) realtorViews += platformViews;
        else if (lowerPlatform.includes("matrix") || lowerPlatform.includes("mls") || lowerPlatform.includes("canopy")) mlsViews += platformViews;
        else if (lowerPlatform.includes("onehome")) oneHomeViews += platformViews;
        else if (lowerPlatform.includes("trulia")) truliaViews += platformViews;
        else otherSourcesViews += platformViews;
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
    zillowViews,
    realtorViews,
    mlsViews,
    oneHomeViews,
    truliaViews,
    otherSourcesViews,
  };
}

// ─── Date Utilities ─────────────────────────────────────────────────────────
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateForListTrac(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

function getWeeksBetween(startDate, endDate) {
  const weeks = [];
  let current = new Date(startDate);
  current = getWeekStart(current);

  while (current <= endDate) {
    weeks.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }

  return weeks;
}

// ─── Main Backfill ──────────────────────────────────────────────────────────
async function backfillListingStats(conn, listing) {
  const { id, address, mlsNumber, listDate, status } = listing;
  const listDateObj = new Date(listDate);
  const today = new Date();
  
  // Limit to last 12 weeks for faster backfill
  const twelveWeeksAgo = new Date(today);
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84); // 12 weeks
  const startDate = new Date(Math.max(listDateObj.getTime(), twelveWeeksAgo.getTime()));

  console.log(`\n[${address}] Starting backfill from ${formatDate(startDate)} to ${formatDate(today)}`);

  const weeks = getWeeksBetween(startDate, today);
  console.log(`[${address}] Found ${weeks.length} weeks to backfill`);

  const token = await getOrRefreshToken();

  for (let i = 0; i < weeks.length; i++) {
    const weekStart = weeks[i];
    const weekEnd = new Date(weeks[i + 1] || today);
    weekEnd.setDate(weekEnd.getDate() - 1);

    const startDateStr = formatDateForListTrac(listDateObj); // Always from list date
    const endDateStr = formatDateForListTrac(weekEnd); // Up to end of this week

    try {
      console.log(`  [Week ${i + 1}/${weeks.length}] ${formatDate(weekStart)} - ${formatDate(weekEnd)}`);

      const metrics = await getListingMetrics(token, mlsNumber, startDateStr, endDateStr);

      // Check if record exists
      const [existing] = await conn.query(
        "SELECT id FROM weekly_stats WHERE listingId = ? AND weekOf = ?",
        [id, formatDate(weekStart)]
      );

      if (existing.length > 0) {
        // Update
        await conn.query(
          `UPDATE weekly_stats SET 
            listtracViews = ?, listtracInquiries = ?, listtracShares = ?, listtracFavorites = ?, listtracVTourViews = ?,
            zillowListtracViews = ?, realtorListtracViews = ?, mlsListtracViews = ?, oneHomeListtracViews = ?, truliaListtracViews = ?, otherSourcesListtracViews = ?,
            platformBreakdown = ?, dateRangeStart = ?, dateRangeEnd = ?, updatedAt = NOW()
            WHERE id = ?`,
          [
            metrics.views, metrics.inquiries, metrics.shares, metrics.favorites, metrics.vTourViews,
            metrics.zillowViews, metrics.realtorViews, metrics.mlsViews, metrics.oneHomeViews, metrics.truliaViews, metrics.otherSourcesViews,
            JSON.stringify(metrics.platformBreakdown), startDateStr, endDateStr,
            existing[0].id,
          ]
        );
        console.log(`    ✓ Updated: ${metrics.views} views`);
      } else {
        // Insert
        await conn.query(
          `INSERT INTO weekly_stats (listingId, weekOf, listtracViews, listtracInquiries, listtracShares, listtracFavorites, listtracVTourViews,
            zillowListtracViews, realtorListtracViews, mlsListtracViews, oneHomeListtracViews, truliaListtracViews, otherSourcesListtracViews,
            platformBreakdown, dateRangeStart, dateRangeEnd, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            id, formatDate(weekStart),
            metrics.views, metrics.inquiries, metrics.shares, metrics.favorites, metrics.vTourViews,
            metrics.zillowViews, metrics.realtorViews, metrics.mlsViews, metrics.oneHomeViews, metrics.truliaViews, metrics.otherSourcesViews,
            JSON.stringify(metrics.platformBreakdown), startDateStr, endDateStr,
          ]
        );
        console.log(`    ✓ Created: ${metrics.views} views`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`    ✗ Error: ${error.message}`);
    }
  }

  console.log(`[${address}] Backfill complete`);
}

// ─── Execute ────────────────────────────────────────────────────────────────
async function main() {
  let conn;
  try {
    conn = await getDbConnection();
    console.log("[DB] Connected");

    // Get all active/under contract listings
    const [listings] = await conn.query(
      "SELECT id, address, mlsNumber, listDate, status FROM listings WHERE status IN ('Active', 'Under Contract') ORDER BY listDate"
    );

    console.log(`\n[Main] Found ${listings.length} listings to backfill\n`);

    for (const listing of listings) {
      await backfillListingStats(conn, listing);
    }

    console.log("\n[Main] Backfill complete!");
  } catch (error) {
    console.error("[Error]", error);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main();
