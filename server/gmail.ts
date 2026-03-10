/**
 * Gmail API Integration
 * Fetches ShowingTime emails from callcenter@showingtime.com
 */

import { invokeLLM } from "./_core/llm";

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    mimeType: string;
    headers: Array<{ name: string; value: string }>;
    parts?: Array<{
      mimeType: string;
      headers: Array<{ name: string; value: string }>;
      body: { data?: string; size: number };
    }>;
    body: { data?: string; size: number };
  };
}

/**
 * Fetch ShowingTime emails from Gmail
 * Uses the Manus built-in Gmail integration
 */
export async function fetchShowingTimeEmails(maxResults: number = 10): Promise<GmailMessage[]> {
  try {
    // Use the built-in Manus Gmail integration via LLM to fetch emails
    // This is a workaround since we don't have direct Gmail API access
    // In production, you'd use the Gmail API directly with OAuth

    console.log("[Gmail] Fetching ShowingTime emails...");

    // For now, return empty array - you'll need to set up Gmail API credentials
    // This is a placeholder that shows the integration point
    return [];
  } catch (error) {
    console.error("[Gmail] Fetch failed:", error);
    throw error;
  }
}

/**
 * Extract email body from Gmail message
 */
export function extractEmailBody(message: GmailMessage): string {
  try {
    const payload = message.payload;

    // Check if message has parts (multipart)
    if (payload.parts && payload.parts.length > 0) {
      // Find HTML part
      const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
      if (htmlPart && htmlPart.body.data) {
        return Buffer.from(htmlPart.body.data, "base64").toString("utf-8");
      }

      // Fallback to text part
      const textPart = payload.parts.find((p) => p.mimeType === "text/plain");
      if (textPart && textPart.body.data) {
        return Buffer.from(textPart.body.data, "base64").toString("utf-8");
      }
    }

    // Single part message
    if (payload.body.data) {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    }

    return "";
  } catch (error) {
    console.error("[Gmail] Extract body error:", error);
    return "";
  }
}

/**
 * Get email subject from Gmail message
 */
export function getEmailSubject(message: GmailMessage): string {
  const headers = message.payload.headers || [];
  const subjectHeader = headers.find((h) => h.name === "Subject");
  return subjectHeader ? subjectHeader.value : "";
}

/**
 * Get email message ID
 */
export function getEmailMessageId(message: GmailMessage): string {
  const headers = message.payload.headers || [];
  const messageIdHeader = headers.find((h) => h.name === "Message-ID");
  return messageIdHeader ? messageIdHeader.value : message.id;
}
