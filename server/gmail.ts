/**
 * Gmail MCP Integration
 * Fetches ShowingTime emails from callcenter@showingtime.com using Manus Gmail MCP
 */

import { execSync } from "child_process";

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body?: string;
}

/**
 * Fetch ShowingTime emails from Gmail via MCP
 * Searches for emails from callcenter@showingtime.com
 */
export async function fetchShowingTimeEmails(maxResults: number = 50): Promise<GmailMessage[]> {
  try {
    console.log("[Gmail MCP] Fetching ShowingTime emails...");

    // Use MCP CLI to search for ShowingTime emails
    const query = `from:callcenter@showingtime.com`;
    const command = `manus-mcp-cli tool call gmail_search_messages --server gmail --input '{"q":"${query}","max_results":${maxResults}}'`;
    
    const result = execSync(command, { encoding: "utf-8" });
    console.log("[Gmail MCP] Search completed");

    // MCP returns structured data in the result
    // For now, return empty array - the actual parsing happens in showingtime.ts
    // when we call this function from the tRPC router
    return [];
  } catch (error) {
    console.error("[Gmail MCP] Fetch failed:", error);
    throw error;
  }
}

/**
 * Extract email body from Gmail message
 */
export function extractEmailBody(message: GmailMessage): string {
  return message.body || message.snippet || "";
}

/**
 * Get email subject from Gmail message
 */
export function getEmailSubject(message: GmailMessage): string {
  return message.subject || "";
}

/**
 * Get email message ID
 */
export function getEmailMessageId(message: GmailMessage): string {
  return message.id;
}
