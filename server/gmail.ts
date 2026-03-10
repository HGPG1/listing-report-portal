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
 * Fetch ShowingTime emails from Gmail using MCP
 */
export async function fetchShowingTimeEmails(maxResults: number = 10): Promise<GmailMessage[]> {
  try {
    console.log("[Gmail] Fetching ShowingTime emails via MCP...");

    // Use the Gmail MCP to search for ShowingTime emails
    const { execSync } = await import("child_process");
    
    const query = 'from:callcenter@showingtime.com';
    const command = `manus-mcp-cli tool call gmail_search_messages --server gmail --input '{"query": "${query}", "max_results": ${maxResults}}'`;
    
    try {
      const result = execSync(command, { encoding: "utf-8" });
      const parsed = JSON.parse(result);
      
      if (parsed.messages && Array.isArray(parsed.messages)) {
        console.log(`[Gmail] Found ${parsed.messages.length} ShowingTime emails`);
        return parsed.messages;
      }
      
      console.log("[Gmail] No ShowingTime emails found");
      return [];
    } catch (error) {
      console.error("[Gmail] MCP call failed:", error);
      return [];
    }
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
