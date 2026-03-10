import { describe, it, expect } from "vitest";
import { parseShowingTimeEmail } from "./showingtime";

describe("ShowingTime Email Parser", () => {
  const sampleEmailBody = `
    <html>
      <body>
        <div>
          <h2>Showing Reschedule Received</h2>
          <img src="property.jpg" alt="6039 Ancestry Trail" />
          <h3>6039 Ancestry Trail, Indian Land, SC 29707</h3>
          <p>$825,000 | ACTIVE | ID# 4349742</p>
          <p>Subdivision: The Estates At Covington</p>
          <p>Presented by: Nicole McAlister</p>
          <p>You have not shown this listing before. Your Buyer: Brian</p>
          
          <h4>Appointment Details</h4>
          <p>Showing</p>
          <p>Saturday, March 7, 2026</p>
          <p>1:00 PM - 2:00 PM</p>
          <p><s>Saturday, March 7, 2026</s></p>
          <p><s>11:00 AM - 12:00 PM</s></p>
        </div>
      </body>
    </html>
  `;

  it("should parse address correctly", () => {
    const result = parseShowingTimeEmail(
      "Showing Reschedule Received",
      sampleEmailBody,
      "msg-123"
    );
    expect(result).not.toBeNull();
    expect(result?.address).toBe("6039 Ancestry Trail, Indian Land, SC 29707");
  });

  it("should parse MLS number correctly", () => {
    const result = parseShowingTimeEmail(
      "Showing Reschedule Received",
      sampleEmailBody,
      "msg-123"
    );
    expect(result?.mlsNumber).toBe("4349742");
  });

  it("should parse list price correctly", () => {
    const result = parseShowingTimeEmail(
      "Showing Reschedule Received",
      sampleEmailBody,
      "msg-123"
    );
    expect(result?.listPrice).toBe(825000);
  });

  it("should parse listing agent correctly", () => {
    const result = parseShowingTimeEmail(
      "Showing Reschedule Received",
      sampleEmailBody,
      "msg-123"
    );
    expect(result?.listingAgent).toBe("Nicole McAlister");
  });

  it("should parse buyer name correctly", () => {
    const result = parseShowingTimeEmail(
      "Showing Reschedule Received",
      sampleEmailBody,
      "msg-123"
    );
    expect(result?.buyerName).toBe("Brian");
  });

  it("should parse time slot correctly", () => {
    const result = parseShowingTimeEmail(
      "Showing Reschedule Received",
      sampleEmailBody,
      "msg-123"
    );
    expect(result?.timeSlot).toContain("1:00 PM - 2:00 PM");
  });

  it("should detect rescheduled status from subject", () => {
    const result = parseShowingTimeEmail(
      "Showing Reschedule Received",
      sampleEmailBody,
      "msg-123"
    );
    expect(result?.status).toBe("rescheduled");
  });

  it("should detect requested status", () => {
    const result = parseShowingTimeEmail(
      "New Showing Request",
      sampleEmailBody,
      "msg-123"
    );
    expect(result?.status).toBe("requested");
  });

  it("should detect confirmed status", () => {
    const result = parseShowingTimeEmail(
      "Showing Confirmed",
      sampleEmailBody,
      "msg-123"
    );
    expect(result?.status).toBe("confirmed");
  });

  it("should detect cancelled status", () => {
    const result = parseShowingTimeEmail(
      "Showing Cancelled",
      sampleEmailBody,
      "msg-123"
    );
    expect(result?.status).toBe("cancelled");
  });

  it("should preserve message ID", () => {
    const result = parseShowingTimeEmail(
      "Showing Reschedule Received",
      sampleEmailBody,
      "msg-abc-123"
    );
    expect(result?.emailMessageId).toBe("msg-abc-123");
  });

  it("should return null for invalid email", () => {
    const result = parseShowingTimeEmail(
      "Invalid Email",
      "No address data here",
      "msg-123"
    );
    expect(result).toBeNull();
  });
});
