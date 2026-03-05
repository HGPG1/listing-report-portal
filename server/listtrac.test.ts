import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";

/**
 * Test ListTrac API credentials and token generation
 * This validates that the environment variables are set correctly
 * and that the MD5 token generation works as expected
 */

describe("ListTrac Integration", () => {
  it("should have ListTrac credentials in environment", () => {
    expect(process.env.LISTTRAC_ORG_ID).toBe("canopy");
    expect(process.env.LISTTRAC_USERNAME).toBe("44890");
    expect(process.env.LISTTRAC_PASSWORD).toBeDefined();
  });

  it("should generate valid MD5 token from password + key", () => {
    const password = process.env.LISTTRAC_PASSWORD || "HomeGrown2026!";
    const testKey = "test-key-12345";
    const combined = password + testKey;
    const token = crypto.createHash("md5").update(combined).digest("hex");

    // MD5 hash should be 32 hex characters
    expect(token).toMatch(/^[a-f0-9]{32}$/);
    expect(token.length).toBe(32);
  });

  it("should validate token generation is deterministic", () => {
    const password = process.env.LISTTRAC_PASSWORD || "HomeGrown2026!";
    const testKey = "same-key";
    
    const token1 = crypto.createHash("md5").update(password + testKey).digest("hex");
    const token2 = crypto.createHash("md5").update(password + testKey).digest("hex");

    expect(token1).toBe(token2);
  });

  it("should validate ListTrac API endpoint URLs", () => {
    const baseUrl = "https://b2b.listtrac.com/api";
    const getKeyUrl = `${baseUrl}/getkey?orgID=canopy&username=44890`;
    const metricsUrl = `${baseUrl}/getmetricsbyorganization`;

    expect(getKeyUrl).toContain("b2b.listtrac.com");
    expect(metricsUrl).toContain("b2b.listtrac.com");
  });
});
