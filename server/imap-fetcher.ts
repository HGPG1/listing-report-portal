import Imap from "imap";
import { getDb } from "./db";
import { showingRequests, listings } from "../drizzle/schema";
import { eq } from "drizzle-orm";

function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, "") // join soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function parseShowingTimeEmail(html: string): {
  address?: string;
  mls?: string;
  showingTime?: Date;
  status?: string;
  buyer?: string;
  agent?: string;
  listPrice?: string;
} | null {
  try {
    const addressMatch = html.match(/([0-9]+\s+[\w\s]+(?:Drive|Street|Road|Lane|Avenue|Boulevard|Court|Way|Circle|Place|Terrace|Parkway|Trail|Blvd|St|Rd|Ave|Dr|Ln|Ct|Pl|Ter|Pkwy)[\s,]+[\w\s]+,\s+[A-Z]{2}\s+\d{5})/i);
    const address = addressMatch ? addressMatch[1] : undefined;

    const mlsMatch = html.match(/ID#\s*(\d+)/i);
    const mls = mlsMatch ? mlsMatch[1] : undefined;

    const timeMatch = html.match(/(\w+day),\s+(\w+)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    let showingTime: Date | undefined;
    if (timeMatch) {
      const [, , month, day, year, hour, minute, ampm] = timeMatch;
      const monthNum = new Date(`${month} 1, 2000`).getMonth();
      let hourNum = parseInt(hour);
      if (ampm === "PM" && hourNum !== 12) hourNum += 12;
      if (ampm === "AM" && hourNum === 12) hourNum = 0;
      showingTime = new Date(parseInt(year), monthNum, parseInt(day), hourNum, parseInt(minute));
    }

    const statusMatch = html.match(/Showing\s+(Requested|Rescheduled|Confirmed|Cancelled)/i);
    const status = statusMatch ? statusMatch[1].toLowerCase() : "requested";

    const buyerMatch = html.match(/Your Buyer:\s*([^<\n]+)/i);
    const buyer = buyerMatch ? buyerMatch[1].trim() : undefined;

    const agentMatch = html.match(/Presented by:\s*([^<\n]+)/i);
    const agent = agentMatch ? agentMatch[1].trim() : undefined;

    const priceMatch = html.match(/\$[\d,]+(?:\.\d{2})?/);
    const listPrice = priceMatch ? priceMatch[0] : undefined;

    if (address || mls) {
      return { address, mls, showingTime, status, buyer, agent, listPrice };
    }

    return null;
  } catch (error) {
    console.error("Error parsing ShowingTime email:", error);
    return null;
  }
}

export async function fetchShowingTimeEmails(mlsNumber?: string): Promise<{
  fetched: number;
  parsed: number;
  stored: number;
  errors: string[];
}> {
  const result = { fetched: 0, parsed: 0, stored: 0, errors: [] as string[] };

  const GMAIL_PASSWORD = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  const GMAIL_USER = "brian@homegrownpropertygroup.com";

  console.log(`[IMAP] GMAIL_APP_PASSWORD is ${GMAIL_PASSWORD ? "SET (" + GMAIL_PASSWORD.length + " chars)" : "NOT SET"}`);

  if (!GMAIL_PASSWORD) {
    result.errors.push("GMAIL_APP_PASSWORD not configured");
    return result;
  }

  return new Promise((resolve) => {
    const imap = new Imap({
      user: GMAIL_USER,
      password: GMAIL_PASSWORD,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    imap.on("error", (err: Error) => {
      console.error("[IMAP] Connection error:", err.message);
      result.errors.push(`IMAP error: ${err.message}`);
      resolve(result);
    });

    // CRITICAL: openBox must be called inside the 'ready' event
    imap.once("ready", () => {
      console.log("[IMAP] Connection ready, opening INBOX...");

      imap.openBox("INBOX", true, (err: Error | null) => {
        if (err) {
          console.error("[IMAP] Failed to open INBOX:", err.message);
          result.errors.push(`Failed to open INBOX: ${err.message}`);
          imap.end();
          return resolve(result);
        }

        console.log("[IMAP] INBOX opened, searching for ShowingTime emails...");

        imap.search([["FROM", "callcenter@showingtime.com"]], async (err: Error | null, results: number[]) => {
          if (err) {
            console.error("[IMAP] Search failed:", err.message);
            result.errors.push(`Search failed: ${err.message}`);
            imap.end();
            return resolve(result);
          }

          result.fetched = results.length;
          console.log(`[IMAP] Found ${results.length} ShowingTime emails`);

          if (results.length === 0) {
            imap.end();
            return resolve(result);
          }

          // Get most recent 50 emails (or filter by MLS if provided)
          const sortedResults = results.slice().sort((a, b) => b - a);
          const toFetch = sortedResults.slice(0, 50);
          const f = imap.fetch(toFetch, { bodies: ["HEADER", "TEXT"], struct: true });

          let processedCount = 0;

          f.on("message", (msg) => {
            let emailBody = "";
            let emailHeaders: Record<string, string> = {};
            let bodyStreamsTotal = 0;
            let bodyStreamsEnded = 0;
            let msgEnded = false;

            const tryProcess = async () => {
              if (!msgEnded || bodyStreamsEnded < bodyStreamsTotal) return;
              try {
                const decoded = decodeQuotedPrintable(emailBody);
                const showingData = parseShowingTimeEmail(decoded);
                console.log(`[IMAP] Email parsed: mls=${showingData?.mls} address=${showingData?.address?.substring(0,30)}`);
                if (showingData) {
                  result.parsed++;
                  try {
                    const db = await getDb();
                    if (db) {
                      let listingId: number | null = null;
                      if (showingData.mls) {
                        const listingResult = await db.select().from(listings).where(eq(listings.mlsNumber, showingData.mls)).limit(1);
                        if (listingResult.length > 0) listingId = listingResult[0].id;
                      }
                      if (!listingId) {
                        console.log(`[IMAP] No listing found for MLS ${showingData.mls}, skipping`);
                      } else {
                        const insertValues: any = {
                          listingId,
                          address: showingData.address || "",
                          mlsNumber: showingData.mls || null,
                          listPrice: showingData.listPrice ? showingData.listPrice.replace('$','').replace(/,/g,'') : null,
                          requestedTime: showingData.showingTime || null,
                          confirmedTime: null,
                          timeSlot: null,
                          buyerName: showingData.buyer || null,
                          listingAgent: showingData.agent || null,
                          showingAgent: null,
                          emailSubject: emailHeaders["subject"] || null,
                          emailMessageId: (emailHeaders["message-id"] || `${showingData.mls}-${Date.now()}-${Math.random()}`).substring(0, 499),
                          rawEmailBody: decoded.substring(0, 65535),
                          feedback: null,
                          rating: null,
                        };
                        await db.insert(showingRequests).values([insertValues]);
                        result.stored++;
                      }
                    }
                  } catch (dbErr) {
                    result.errors.push(`DB error: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
                  }
                }
              } catch (e) {
                console.error("[IMAP] Error processing email:", e);
              }
              processedCount++;
              if (processedCount >= toFetch.length) {
                imap.end();
                resolve(result);
              }
            };

            msg.on("body", (stream, info) => {
              bodyStreamsTotal++;
              let data = "";
              stream.on("data", (chunk) => { data += chunk.toString("utf8"); });
              stream.on("end", () => {
                if (info.which.startsWith("HEADER")) {
                  data.split("\r\n").forEach((line) => {
                    const colonIdx = line.indexOf(": ");
                    if (colonIdx > 0) {
                      emailHeaders[line.substring(0, colonIdx).toLowerCase()] = line.substring(colonIdx + 2);
                    }
                  });
                } else {
                  emailBody = data;
                }
                bodyStreamsEnded++;
                tryProcess();
              });
            });

            msg.once("end", () => {
              msgEnded = true;
              tryProcess();
            });
          });

          f.on("error", (err: Error) => {
            console.error("[IMAP] Fetch error:", err.message);
            result.errors.push(`Fetch error: ${err.message}`);
          });

          f.once("end", () => {
            setTimeout(() => {
              if (processedCount < toFetch.length) {
                imap.end();
                resolve(result);
              }
            }, 3000);
          });
        });
      });
    });

    console.log("[IMAP] Connecting...");
    imap.connect();
  });
}
