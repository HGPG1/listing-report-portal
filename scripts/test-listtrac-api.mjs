#!/usr/bin/env node

/**
 * Test ListTrac API to see what data is available
 * Check if list date or other metadata is returned
 */

import crypto from "crypto";

const LISTTRAC_BASE_URL = "https://b2b.listtrac.com/api";
const ORG_ID = process.env.LISTTRAC_ORG_ID ?? "canopy";
const USERNAME = process.env.LISTTRAC_USERNAME ?? "44890";
const PASSWORD = process.env.LISTTRAC_PASSWORD ?? "HomeGrown2026!";

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

async function testMetricsAPI() {
  const key = await getKey();
  const token = generateToken(key);

  console.log("[Test] Testing ListTrac metrics API for MLS 4336731 (Butters Way)");
  
  // Try MM/DD/YYYY format
  console.log("\n[Test] Trying YYYYMMDD format: 20260116 to 20260309");
  const payload = {
    request: {
      token,
      viewtype: "listing",
      viewtypeID: "4336731",
      metric: "view,inquiry,share,favorite",
      details: "true",
      startdate: "20260116",
      enddate: "20260309",
    },
  };

  let response = await fetch(`${LISTTRAC_BASE_URL}/getmetricsbyorganization`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let data = await response.json();
  console.log("\n[Response] Full API response:");
  console.log(JSON.stringify(data, null, 2));

  // Check for list date in response
  if (data.response?.metrics?.sites) {
    console.log("\n[Analysis] Sites found:");
    for (const site of data.response.metrics.sites) {
      console.log(`  - ${site.sitename}`);
      if (site.dates) {
        console.log(`    Dates: ${site.dates.map(d => d.date).join(", ")}`);
      }
    }
  }
}

testMetricsAPI().catch(console.error);
