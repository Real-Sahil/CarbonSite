import { NextRequest } from "next/server";
import { describe, expect, test, beforeEach } from "vitest";
import {
  rateLimit,
  rateLimitKey,
  resetRateLimitBucketsForTests,
} from "../rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimitBucketsForTests();
  });

  test("allows requests within the window limit", () => {
    const req = new NextRequest("https://example.test/api", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    expect(rateLimit(req, { key: "comments", limit: 2, windowMs: 60_000 })).toBeNull();
    expect(rateLimit(req, { key: "comments", limit: 2, windowMs: 60_000 })).toBeNull();
  });

  test("returns 429 after the limit is exceeded", () => {
    const req = new NextRequest("https://example.test/api", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    expect(rateLimit(req, { key: "comments", limit: 1, windowMs: 60_000 })).toBeNull();
    const response = rateLimit(req, { key: "comments", limit: 1, windowMs: 60_000 });

    expect(response?.status).toBe(429);
  });

  test("scopes keys by org, action and user", () => {
    expect(rateLimitKey("org-1", "comments", "user-1")).toBe(
      "org:org-1:comments:user-1",
    );
  });
});
