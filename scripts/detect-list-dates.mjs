#!/usr/bin/env node

/**
 * Detect List Dates from ListTrac
 * 
 * For each listing, calls ListTrac with a wide date range (5 years back)
 * and finds the earliest date with data, then updates the database
 */

import crypto from "crypto";
import mysql from "mysql2/promise";

const LISTTRAC_BASE_URL = "https://b2b.listtrac.com/api";
const ORG_ID = process.env.LISTTRAC_ORG_ID ?? "canopy";
const USERNAME = process.env.LISTTRAC_USERNAME ?? "44890";
const PASSWORD = process.env.LISTTRAC_PASSWORD ?? "HomeGrown2026!";

let cachedToken = null;
let cachedTokenTime = 0;
const TOKEN_CACHE_TTL = 3600000;

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
  return cachedToken;
}

function formatDateForListTrac(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

async function detectListDate(token, mlsNumber) {
  // Search 5 years back
  const today = new Date();
  const fiveYearsAgo = new Date(today);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  const payload = {
    request: {
      token,
      viewtype: "listing",
      viewtypeID: mlsNumber,
      metric: "view",
      details: "true",
      startdate: formatDateForListTrac(fiveYearsAgo),
      enddate: formatDateForListTrac(today),
    },
  };

  const response = await fetch(`${LISTTRAC_BASE_URL}/getmetricsbyorganization`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!data.response || data.response.returncode !== 0) {
    throw new Error(`ListTrac error: ${data.response?.message || "Unknown"}`);
  }

  // Find earliest date with data
  let earliestDate = null;

  if (data.response.metrics?.sites) {
    for (const site of data.response.metrics.sites) {
      if (site.dates) {
        for (const dateEntry of site.dates) {
          if (dateEntry.date && dateEntry.details && dateEntry.details.length > 0) {
            const dateStr = dateEntry.date;
            const dateObj = new Date(
              parseInt(dateStr.substring(0, 4)),
              parseInt(dateStr.substring(4, 6)) - 1,
              parseInt(dateStr.substring(6, 8))
            );
            if (!earliestDate || dateObj < earliestDate) {
              earliestDate = dateObj;
            }
          }
        }
      }
    }
  }

  return earliestDate;
}

async function main() {
  let conn;
  try {
    conn = await getDbConnection();
    console.log("[DB] Connected");

    const [listings] = await conn.query(
      "SELECT id, address, mlsNumber, status FROM listings WHERE status IN ('Active', 'Under Contract') ORDER BY id"
    );

    console.log(`\n[Main] Found ${listings.length} listings\n`);

    const token = await getOrRefreshToken();

    for (const listing of listings) {
      try {
        console.log(`[${listing.address}] Detecting list date for MLS ${listing.mlsNumber}...`);
        const listDate = await detectListDate(token, listing.mlsNumber);

        if (listDate) {
          const dateStr = `${listDate.getFullYear()}-${String(listDate.getMonth() + 1).padStart(2, "0")}-${String(listDate.getDate()).padStart(2, "0")}`;
          console.log(`  ✓ Found: ${dateStr}`);
          await conn.query("UPDATE listings SET listDate = ? WHERE id = ?", [listDate, listing.id]);
        } else {
          console.log(`  ✗ No data found`);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`  ✗ Error: ${error.message}`);
      }
    }

    console.log("\n[Main] Complete!");
  } catch (error) {
    console.error("[Error]", error);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

async function getDbConnection() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  return connection;
}

main();
