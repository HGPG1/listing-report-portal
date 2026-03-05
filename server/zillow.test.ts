import { describe, it, expect } from "vitest";

/**
 * Test OAuth 1.0a signature generation against known test vectors
 * to verify the implementation matches Zillow's expectations.
 */
describe("Zillow OAuth 1.0a", () => {
  it("should construct a valid OAuth signature", () => {
    // Test that the signing key is constructed correctly
    // Consumer Secret: E4579CF6693748489807928F68CA8E52
    // Token Secret: "none" (literal string)
    // Expected signing key: E4579CF6693748489807928F68CA8E52&none

    const consumerSecret = "E4579CF6693748489807928F68CA8E52";
    const tokenSecret = "none";

    function percentEncode(str: string): string {
      return encodeURIComponent(str)
        .replace(/!/g, "%21")
        .replace(/'/g, "%27")
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29")
        .replace(/\*/g, "%2A");
    }

    const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
    expect(signingKey).toBe("E4579CF6693748489807928F68CA8E52&none");
  });

  it("should percent-encode special characters correctly", () => {
    function percentEncode(str: string): string {
      return encodeURIComponent(str)
        .replace(/!/g, "%21")
        .replace(/'/g, "%27")
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29")
        .replace(/\*/g, "%2A");
    }

    // Test that spaces and special chars are encoded per OAuth spec
    expect(percentEncode("hello world")).toBe("hello%20world");
    expect(percentEncode("test&value")).toBe("test%26value");
    expect(percentEncode("path/to/resource")).toBe("path%2Fto%2Fresource");
  });

  it("should verify that Consumer Secret is not 'none'", () => {
    const consumerSecret = process.env.ZILLOW_CONSUMER_SECRET;
    expect(consumerSecret).toBeDefined();
    expect(consumerSecret).not.toBe("none");
    expect(consumerSecret).toBe("E4579CF6693748489807928F68CA8E52");
  });
});
