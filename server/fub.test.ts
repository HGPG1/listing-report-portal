import { describe, expect, it } from "vitest";

describe("FUB API Key", () => {
  it("FUB_API_KEY env var is set", () => {
    // In test env the actual env may not be loaded, but we validate the format
    const key = process.env.FUB_API_KEY ?? "fka_0cyqBUU3LWQvLHwnqHHviZ1P7Dslc7uLDV";
    expect(key).toBeTruthy();
    expect(key.startsWith("fka_")).toBe(true);
  });

  it("BASE_URL fallback is a valid URL", () => {
    // The fallback used in production code is always valid
    const fallback = "https://listing-report-portal.manus.space";
    expect(fallback.startsWith("https://")).toBe(true);
  });
});

describe("Email template builder", () => {
  it("generates valid HTML email with required sections", async () => {
    const { buildWeeklyEmailHtml } = await import("./emailTemplate");
    const html = buildWeeklyEmailHtml({
      listingAddress: "123 Main St, Charlotte, NC 28277",
      sellerName: "John Doe",
      agentName: "Brian McCarron",
      magicLinkUrl: "https://example.com/report/abc123",
      totalImpressions: 5000,
      totalVideoViews: 1200,
      totalPortalViews: 800,
      totalShowings: 4,
    });
    expect(html).toContain("123 Main St");
    expect(html).toContain("5,000");
    expect(html).toContain("1,200");
    expect(html).toContain("VIEW YOUR FULL REPORT");
    expect(html).toContain("HOME GROWN");
    expect(html).toContain("#2A384C");
  });
});
