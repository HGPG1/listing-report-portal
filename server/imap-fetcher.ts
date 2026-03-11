import Imap from "imap";
import { getDb } from "./db";
import { showingRequests, listings } from "../drizzle/schema";
import { eq } from "drizzle-orm";

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

export async function fetchShowingTimeEmails(): Promise<{
  fetched: number;
  parsed: number;
  stored: number;
  errors: string[];
}> {
  const result = { fetched: 0, parsed: 0, stored: 0, errors: [] as string[] };

  // Read password at runtime, not at module load time
  const GMAIL_PASSWORD = process.env.GMAIL_APP_PASSWORD;
  const GMAIL_USER = "brian@homegrownpropertygroup.com";

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
      result.errors.push(`IMAP connection error: ${err.message}`);
      resolve(result);
    });

    imap.on("end", () => {
      console.log("[IMAP] Connection ended");
    });

    imap.openBox("INBOX", false, async (err: Error | null) => {
      if (err) {
        console.error("[IMAP] Failed to open INBOX:", err.message);
        result.errors.push(`Failed to open INBOX: ${err.message}`);
        imap.end();
        return resolve(result);
      }

      console.log("[IMAP] INBOX opened successfully");

      // Search for ShowingTime emails from callcenter@showingtime.com
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

        // Fetch only the first 50 to avoid overwhelming the system
        const toFetch = results.slice(0, 50);
        const f = imap.fetch(toFetch, { bodies: "HEADER.FIELDS (FROM TO SUBJECT DATE) BODY[TEXT]" });

        let processedCount = 0;

        f.on("message", (msg) => {
          let emailBody = "";
          let emailHeaders: any = {};

          msg.on("body", (stream, info) => {
            let data = "";
            stream.on("data", (chunk) => {
              data += chunk.toString("utf8");
            });
            stream.on("end", () => {
              if (info.which === "HEADER.FIELDS (FROM TO SUBJECT DATE)") {
                // Parse headers
                const lines = data.split("\r\n");
                lines.forEach((line) => {
                  const [key, ...valueParts] = line.split(": ");
                  if (key && valueParts.length > 0) {
                    emailHeaders[key.toLowerCase()] = valueParts.join(": ");
                  }
                });
              } else if (info.which === "BODY[TEXT]") {
                emailBody = data;
              }
            });
          });

          msg.on("attributes", async (attrs) => {
            // After all body parts are read, process the email
            setTimeout(async () => {
              try {
                const html = emailBody || "";
                const showingData = parseShowingTimeEmail(html);

                if (showingData) {
                  result.parsed++;

                  try {
                    const db = await getDb();
                    if (!db) {
                      result.errors.push("Database connection failed");
                      return;
                    }

                    const messageId = emailHeaders["message-id"] || `${showingData.mls}-${showingData.showingTime?.getTime()}`;

                    // Find listing by MLS number
                    let listingId = 1;
                    if (showingData.mls) {
                      try {
                        const listingResult = await db
                          .select()
                          .from(listings)
                          .where(eq(listings.mlsNumber, showingData.mls))
                          .limit(1);
                        if (listingResult.length > 0) {
                          listingId = listingResult[0].id;
                        }
                      } catch (e) {
                        console.error(`Could not find listing by MLS ${showingData.mls}:`, e);
                      }
                    }

                    const values: any = {
                      listingId: listingId,
                      address: showingData.address || "",
                      mlsNumber: showingData.mls,
                      listPrice: showingData.listPrice,
                      requestedTime: showingData.showingTime,
                      confirmedTime: null,
                      timeSlot: null,
                      status: "requested",
                      buyerName: showingData.buyer,
                      listingAgent: showingData.agent,
                      showingAgent: null,
                      emailSubject: emailHeaders["subject"],
                      emailMessageId: messageId,
                      rawEmailBody: html,
                      feedback: null,
                      rating: null,
                    };

                    await db.insert(showingRequests).values([values]);

                    result.stored++;
                  } catch (dbErr) {
                    result.errors.push(`Database error: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
                  }
                }

                processedCount++;
                if (processedCount === toFetch.length) {
                  imap.end();
                  resolve(result);
                }
              } catch (e) {
                console.error("Error processing email:", e);
                processedCount++;
                if (processedCount === toFetch.length) {
                  imap.end();
                  resolve(result);
                }
              }
            }, 100);
          });
        });

        f.on("error", (err: Error) => {
          console.error("[IMAP] Fetch error:", err.message);
          result.errors.push(`Fetch error: ${err.message}`);
          imap.end();
          resolve(result);
        });

        f.on("end", () => {
          // Wait a bit for all messages to be processed
          setTimeout(() => {
            if (processedCount < toFetch.length) {
              imap.end();
              resolve(result);
            }
          }, 2000);
        });
      });
    });

    // Connect to IMAP
    console.log("[IMAP] Connecting to Gmail IMAP...");
    imap.connect();
  });
}
