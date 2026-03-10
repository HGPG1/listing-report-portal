/**
 * ShowingTime Email Parser
 * Parses emails from callcenter@showingtime.com to extract showing request data
 * Tracks: requested, rescheduled, confirmed, completed, cancelled statuses
 */

import { getDb } from "./db";
import { showingRequests, listings } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export interface ParsedShowingEmail {
  address: string;
  mlsNumber: string;
  listPrice: number | null;
  requestedTime: Date | null;
  confirmedTime: Date | null;
  timeSlot: string;
  status: "requested" | "rescheduled" | "confirmed" | "completed" | "cancelled";
  buyerName: string;
  listingAgent: string;
  showingAgent: string | null;
  emailSubject: string;
  emailMessageId: string;
  rawEmailBody: string;
}

/**
 * Parse ShowingTime email HTML to extract showing details
 */
export function parseShowingTimeEmail(
  emailSubject: string,
  emailBody: string,
  messageId: string
): ParsedShowingEmail | null {
  try {
    // Extract address: "6039 Ancestry Trail, Indian Land, SC 29707"
    const addressMatch = emailBody.match(
      /(\d+\s+[\w\s]+(?:Trail|Street|Road|Avenue|Drive|Lane|Court|Way|Circle|Boulevard|Parkway|Place|Terrace|Blvd|St|Ave|Rd|Dr|Ln|Ct|Pl|Ter|Way|Cir|Sq|Ct|Pl|Ln|Rd|St|Ave|Dr|Blvd|Pkwy|Ter|Way|Cir),\s+([A-Za-z\s]+),\s+([A-Z]{2})\s+(\d{5}))/
    );
    if (!addressMatch) return null;

    const address = `${addressMatch[1]}, ${addressMatch[2]}, ${addressMatch[3]} ${addressMatch[4]}`;
    const city = addressMatch[2];
    const state = addressMatch[3];
    const zip = addressMatch[4];

    // Extract MLS number: "ID# 4349742"
    const mlsMatch = emailBody.match(/ID#\s*(\d+)/);
    const mlsNumber = mlsMatch ? mlsMatch[1] : "";

    // Extract list price: "$825,000"
    const priceMatch = emailBody.match(/\$([0-9,]+)/);
    const listPrice = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ""), 10) : null;

    // Extract listing agent: "Presented by: Nicole McAlister"
    const agentMatch = emailBody.match(/Presented by:\s*([^\n<]+)/);
    const listingAgent = agentMatch ? agentMatch[1].trim() : "";

    // Extract buyer name: "Your Buyer: Brian"
    const buyerMatch = emailBody.match(/Your Buyer:\s*([^\n<.]+)/);
    const buyerName = buyerMatch ? buyerMatch[1].trim() : "";

    // Extract appointment times
    // Look for patterns like "Saturday, March 7, 2026" and "1:00 PM - 2:00 PM"
    const dateMatch = emailBody.match(
      /([A-Za-z]+),\s+([A-Za-z]+)\s+(\d+),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/
    );

    let requestedTime: Date | null = null;
    let timeSlot = "";

    if (dateMatch) {
      const [, dayName, month, day, year, hour1, min1, ampm1, hour2, min2, ampm2] = dateMatch;
      timeSlot = `${hour1}:${min1} ${ampm1} - ${hour2}:${min2} ${ampm2}`;

      // Parse the date
      const dateStr = `${month} ${day}, ${year} ${hour1}:${min1} ${ampm1}`;
      requestedTime = new Date(dateStr);
    }

    // Check for rescheduled time (strikethrough text)
    const rescheduledMatch = emailBody.match(
      /(?:<s>|<strike>|text-decoration:\s*line-through)([A-Za-z]+),\s+([A-Za-z]+)\s+(\d+),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i
    );

    let confirmedTime: Date | null = null;
    if (rescheduledMatch) {
      const [, dayName, month, day, year, hour1, min1, ampm1, hour2, min2, ampm2] = rescheduledMatch;
      const dateStr = `${month} ${day}, ${year} ${hour1}:${min1} ${ampm1}`;
      confirmedTime = new Date(dateStr);
    }

    // Determine status from email subject
    let status: "requested" | "rescheduled" | "confirmed" | "completed" | "cancelled" = "requested";
    if (emailSubject.toLowerCase().includes("reschedule")) {
      status = "rescheduled";
    } else if (emailSubject.toLowerCase().includes("confirmed")) {
      status = "confirmed";
    } else if (emailSubject.toLowerCase().includes("cancelled")) {
      status = "cancelled";
    } else if (emailSubject.toLowerCase().includes("completed")) {
      status = "completed";
    }

    return {
      address,
      mlsNumber,
      listPrice,
      requestedTime,
      confirmedTime,
      timeSlot,
      status,
      buyerName,
      listingAgent,
      showingAgent: null,
      emailSubject,
      emailMessageId: messageId,
      rawEmailBody: emailBody,
    };
  } catch (error) {
    console.error("[ShowingTime] Email parse error:", error);
    return null;
  }
}

/**
 * Find or create listing by MLS number
 */
async function findOrCreateListing(
  mlsNumber: string,
  address: string
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Try to find existing listing
  const existing = await db
    .select()
    .from(listings)
    .where(eq(listings.mlsNumber, mlsNumber))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Create new listing if not found
  const [result] = await db.insert(listings).values({
    address,
    mlsNumber,
    status: "Active",
  });

  return result.insertId;
}

/**
 * Store parsed showing request in database
 */
export async function storeShowingRequest(
  parsed: ParsedShowingEmail
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  try {
    // Find or create listing
    const listingId = await findOrCreateListing(parsed.mlsNumber, parsed.address);

    // Check if this email was already processed
    const existing = await db
      .select()
      .from(showingRequests)
      .where(eq(showingRequests.emailMessageId, parsed.emailMessageId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing record
      await db
        .update(showingRequests)
        .set({
          status: parsed.status,
          confirmedTime: parsed.confirmedTime,
          timeSlot: parsed.timeSlot,
          updatedAt: new Date(),
        })
        .where(eq(showingRequests.emailMessageId, parsed.emailMessageId));
    } else {
      // Insert new record
      await db.insert(showingRequests).values({
        listingId,
        address: parsed.address,
        mlsNumber: parsed.mlsNumber,
        listPrice: parsed.listPrice ? String(parsed.listPrice) : null,
        requestedTime: parsed.requestedTime,
        confirmedTime: parsed.confirmedTime,
        timeSlot: parsed.timeSlot,
        status: parsed.status,
        buyerName: parsed.buyerName,
        listingAgent: parsed.listingAgent,
        showingAgent: parsed.showingAgent,
        emailSubject: parsed.emailSubject,
        emailMessageId: parsed.emailMessageId,
        rawEmailBody: parsed.rawEmailBody,
      });
    }

    console.log(`[ShowingTime] Stored showing request for ${parsed.address}`);
  } catch (error) {
    console.error("[ShowingTime] Error storing showing request:", error);
    throw error;
  }
}

/**
 * Get all showing requests for a listing
 */
export async function getShowingRequestsForListing(
  listingId: number
): Promise<any[]> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");
  return db
    .select()
    .from(showingRequests)
    .where(eq(showingRequests.listingId, listingId))
    .orderBy((t: any) => t.createdAt);
}
