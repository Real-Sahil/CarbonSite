import { NextRequest } from "next/server";
import { describe, expect, test, beforeEach } from "vitest";
import {
  rateLimit,
  rateLimitRequest,
  rateLimitKey,
  resetRateLimitBucketsForTests,
} from "../rate-limit";

describe("rateLimit (key-based)", () => {
  beforeEach(() => resetRateLimitBucketsForTests());

  test("allows requests within the window limit", () => {
    expect(rateLimit("test-key", 2, 60_000).allowed).toBe(true);
    expect(rateLimit("test-key", 2, 60_000).allowed).toBe(true);
  });

  test("blocks after limit exceeded", () => {
    rateLimit("test-key", 1, 60_000);
    const result = rateLimit("test-key", 1, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("rateLimitRequest (NextRequest wrapper)", () => {
  beforeEach(() => resetRateLimitBucketsForTests());

  const makeReq = (ip = "203.0.113.10") =>
    new NextRequest("https://example.test/api", {
      headers: { "x-forwarded-for": ip },
    });

  test("returns null when within limit", () => {
    const req = makeReq();
    expect(rateLimitRequest(req, { key: "comments", limit: 2, windowMs: 60_000 })).toBeNull();
    expect(rateLimitRequest(req, { key: "comments", limit: 2, windowMs: 60_000 })).toBeNull();
  });

  test("returns 429 after limit exceeded", () => {
    const req = makeReq();
    rateLimitRequest(req, { key: "comments", limit: 1, windowMs: 60_000 });
    const res = rateLimitRequest(req, { key: "comments", limit: 1, windowMs: 60_000 });
    expect(res?.status).toBe(429);
  });
});

describe("rateLimitKey", () => {
  test("builds canonical key", () => {
    expect(rateLimitKey("org-1", "act", "u-1")).toBe("org:org-1:act:u-1");
    expect(rateLimitKey("org-1", "act")).toBe("org:org-1:act:anonymous");
  });
});
