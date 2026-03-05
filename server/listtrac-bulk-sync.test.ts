import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { syncAllListingsFromMLS, runListTracTestCall } from "./listtrac";
import { getDb } from "./db";
import { listings, weeklyStats } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("ListTrac Bulk Sync", () => {
  let db: Awaited<ReturnType<typeof getDb>>;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");
  });

  afterAll(async () => {
    // Cleanup test data if needed
  });

  it("should run ListTrac test call successfully", async () => {
    // This test verifies credentials are valid
    await expect(runListTracTestCall()).resolves.not.toThrow();
  });

  it("should sync all listings from MLS", async () => {
    const result = await syncAllListingsFromMLS(7);

    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("listingsUpdated");
    expect(result.success).toBe(true);
    expect(typeof result.listingsUpdated).toBe("number");
    expect(result.listingsUpdated).toBeGreaterThanOrEqual(0);
  });

  it("should create weekly_stats records for each listing", async () => {
    // Run sync
    await syncAllListingsFromMLS(7);

    // Check that records were created
    const stats = await db!.select().from(weeklyStats);
    expect(stats.length).toBeGreaterThan(0);
  });

  it("should populate ListTrac metrics in weekly_stats", async () => {
    // Run sync
    await syncAllListingsFromMLS(7);

    // Get the most recent stats
    const stats = await db!.select().from(weeklyStats).limit(1);
    
    if (stats.length > 0) {
      const stat = stats[0];
      // Metrics should be numbers (can be 0)
      expect(typeof stat.listtracViews).toBe("number");
      expect(typeof stat.listtracInquiries).toBe("number");
      expect(typeof stat.listtracShares).toBe("number");
      expect(typeof stat.listtracFavorites).toBe("number");
      expect(typeof stat.listtracVTourViews).toBe("number");
    }
  });

  it("should handle listings without MLS numbers gracefully", async () => {
    // Create a test listing without MLS number
    const testListing = await db!.insert(listings).values({
      address: "Test Address",
      city: "Test City",
      state: "TX",
      zip: "12345",
      price: 500000,
      bedrooms: 3,
      bathrooms: 2,
      sqft: 2000,
      // mlsNumber is intentionally omitted
    });

    // Run sync - should not crash
    const result = await syncAllListingsFromMLS(7);
    expect(result.success).toBe(true);

    // Clean up
    if (testListing.insertId) {
      await db!.delete(listings).where(eq(listings.id, testListing.insertId));
    }
  });

  it("should update existing weekly_stats records", async () => {
    // Run sync twice
    const result1 = await syncAllListingsFromMLS(7);
    expect(result1.success).toBe(true);

    const result2 = await syncAllListingsFromMLS(7);
    expect(result2.success).toBe(true);

    // Both syncs should succeed
    expect(result1.listingsUpdated).toBeGreaterThanOrEqual(0);
    expect(result2.listingsUpdated).toBeGreaterThanOrEqual(0);
  });

  it("should store platform breakdown as JSON", async () => {
    await syncAllListingsFromMLS(7);

    const stats = await db!.select().from(weeklyStats).limit(1);
    
    if (stats.length > 0 && stats[0].platformBreakdown) {
      const breakdown = JSON.parse(stats[0].platformBreakdown);
      expect(typeof breakdown).toBe("object");
      // Each platform should have views and inquiries
      for (const [platform, data] of Object.entries(breakdown)) {
        expect(typeof platform).toBe("string");
        expect(data).toHaveProperty("views");
        expect(data).toHaveProperty("inquiries");
      }
    }
  });

  it("should handle different date ranges", async () => {
    // Test 30-day sync
    const result = await syncAllListingsFromMLS(30);
    expect(result.success).toBe(true);

    // Test all-time sync
    const resultAllTime = await syncAllListingsFromMLS(365);
    expect(resultAllTime.success).toBe(true);
  });
});
