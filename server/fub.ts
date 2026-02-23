/**
 * Follow Up Boss API Integration
 * Posts weekly marketing report events to FUB contacts.
 * FUB then fires its configured Action Plan to send the email.
 */

import axios from "axios";

const FUB_BASE_URL = "https://api.followupboss.com/v1";
const FUB_API_KEY = process.env.FUB_API_KEY ?? "fka_0cyqBUU3LWQvLHwnqHHviZ1P7Dslc7uLDV";

const fubClient = axios.create({
  baseURL: FUB_BASE_URL,
  auth: { username: FUB_API_KEY, password: "" },
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// Log all FUB API calls
fubClient.interceptors.response.use(
  (res) => {
    console.log(`[FUB] ${res.config.method?.toUpperCase()} ${res.config.url} → ${res.status}`);
    return res;
  },
  (err) => {
    const status = err.response?.status ?? "network error";
    console.error(`[FUB] ERROR ${err.config?.method?.toUpperCase()} ${err.config?.url} → ${status}`, err.response?.data);
    return Promise.reject(err);
  }
);

export interface FubEventPayload {
  personId: string;
  type: string;
  description?: string;
  note?: string;
}

/**
 * Post a "Weekly Marketing Report Sent" event to a FUB contact.
 * This triggers the configured Action Plan to send the email.
 */
export async function postFubEvent(payload: FubEventPayload): Promise<string | null> {
  try {
    const res = await fubClient.post("/events", {
      personId: payload.personId,
      type: payload.type,
      description: payload.description,
      note: payload.note,
    });
    return res.data?.id ?? null;
  } catch (err: any) {
    console.error("[FUB] Failed to post event:", err.message);
    return null;
  }
}

/**
 * Post a note to a FUB contact with the magic link and PDF download link.
 */
export async function postFubNote(personId: string, body: string): Promise<string | null> {
  try {
    const res = await fubClient.post("/notes", {
      personId,
      body,
    });
    return res.data?.id ?? null;
  } catch (err: any) {
    console.error("[FUB] Failed to post note:", err.message);
    return null;
  }
}

/**
 * Look up a FUB contact by email to get their personId.
 */
export async function getFubPersonByEmail(email: string): Promise<string | null> {
  try {
    const res = await fubClient.get("/people", { params: { email } });
    const people = res.data?.people ?? [];
    return people[0]?.id?.toString() ?? null;
  } catch (err: any) {
    console.error("[FUB] Failed to look up person:", err.message);
    return null;
  }
}

/**
 * Send the full weekly report event for a listing.
 * Posts event + note with magic link and PDF URL.
 */
export async function sendWeeklyReportToFub(params: {
  fubContactId: string;
  listingAddress: string;
  magicLinkUrl: string;
  pdfUrl?: string;
  agentName?: string;
}): Promise<{ eventId: string | null; noteId: string | null }> {
  const { fubContactId, listingAddress, magicLinkUrl, pdfUrl, agentName } = params;

  const eventId = await postFubEvent({
    personId: fubContactId,
    type: "Weekly Marketing Report Sent",
    description: `Weekly marketing report sent for ${listingAddress}`,
    note: `Report URL: ${magicLinkUrl}${pdfUrl ? `\nPDF: ${pdfUrl}` : ""}`,
  });

  const noteBody = [
    `📊 Weekly Marketing Report — ${listingAddress}`,
    ``,
    `View your full report: ${magicLinkUrl}`,
    pdfUrl ? `Download PDF report card: ${pdfUrl}` : "",
    agentName ? `Prepared by ${agentName} | Home Grown Property Group` : "",
  ].filter(Boolean).join("\n");

  const noteId = await postFubNote(fubContactId, noteBody);

  return { eventId, noteId };
}
