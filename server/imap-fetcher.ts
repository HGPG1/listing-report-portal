import Imap from "imap";
import { simpleParser } from "mailparser";
import { getDb } from "./db";
import { showingRequests, listings } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const GMAIL_USER = "brian@homegrownpropertygroup.com";
const GMAIL_PASSWORD = process.env.GMAIL_APP_PASSWORD;

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
    });

    // Search in INBOX for ShowingTime emails
    imap.openBox("INBOX", false, async (err: Error | null) => {
      if (err) {
        result.errors.push(`Failed to open INBOX: ${err.message}`);
        imap.end();
        return resolve(result);
      }

      // Search for ShowingTime emails by subject line (more reliable than FROM field)
      imap.search(["SUBJECT", "CONFIRMED", "SUBJECT", "RESCHEDULE", "SUBJECT", "REQUESTED"], async (err: Error | null, results: number[]) => {
        if (err) {
          result.errors.push(`Search failed: ${err.message}`);
          imap.end();
          return resolve(result);
        }

        result.fetched = results.length;

        if (results.length === 0) {
          imap.end();
          return resolve(result);
        }

        const f = imap.fetch(results, { bodies: "" });

        f.on("message", (msg) => {
          simpleParser(msg as any, async (err: Error | null, parsed: any) => {
            if (err) {
              result.errors.push(`Parse error: ${err.message}`);
              return;
            }

            const html = parsed.html || parsed.text || "";
            const showingData = parseShowingTimeEmail(html);

            if (showingData) {
              result.parsed++;

              try {
                const db = await getDb();
                if (!db) {
                  result.errors.push("Database connection failed");
                  return;
                }

                const messageId = parsed.messageId || `${showingData.mls}-${showingData.showingTime?.getTime()}`;
                
                // Find listing by MLS number
                let listingId = 1;
                if (showingData.mls) {
                  try {
                    const result = await db
                      .select()
                      .from(listings)
                      .where(eq(listings.mlsNumber, showingData.mls))
                      .limit(1);
                    if (result.length > 0) {
                      listingId = result[0].id;
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
                  emailSubject: null,
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
          });
        });

        f.on("error", (err: Error) => {
          result.errors.push(`Fetch error: ${err.message}`);
        });

        f.on("end", () => {
          imap.end();
          resolve(result);
        });
      });
    });

    imap.on("error", (err: Error) => {
      result.errors.push(`IMAP error: ${err.message}`);
      resolve(result);
    });

    imap.connect();
  });
}
