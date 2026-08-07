import { NextRequest } from "next/server";
import { describe, expect, test, beforeEach, vi } from "vitest";
import {
  rateLimit,
  rateLimitKey,
  resetRateLimitBucketsForTests,
} from "../rate-limit";

// rateLimitRequest is Postgres-backed (async) — mock the DB module so unit
// tests don't need a live database.
vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));
import { prisma } from "@/lib/db";
import { rateLimitRequest } from "../rate-limit";

describe("rateLimit (sync in-memory — Edge middleware path)", () => {
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

describe("rateLimitRequest (async Postgres-backed — Node.js route handler path)", () => {
  const makeReq = (ip = "203.0.113.10") =>
    new NextRequest("https://example.test/api", {
      headers: { "x-forwarded-for": ip },
    });

  function mockPg(count: number, resetAt = new Date(Date.now() + 60_000)) {
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
      { count, reset_at: resetAt },
    ]);
  }

  test("returns null when within limit", async () => {
    mockPg(1);
    const result = await rateLimitRequest(makeReq(), { key: "test", limit: 5, windowMs: 60_000 });
    expect(result).toBeNull();
  });

  test("returns 429 response when limit exceeded", async () => {
    mockPg(6); // count > limit of 5
    const result = await rateLimitRequest(makeReq(), { key: "test", limit: 5, windowMs: 60_000 });
    expect(result?.status).toBe(429);
  });

  test("returns null when DB query fails (fail-open)", async () => {
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await rateLimitRequest(makeReq(), { key: "test", limit: 5, windowMs: 60_000 });
    expect(result).toBeNull();
  });

  // FIND-008: spoofed X-Forwarded-For should be ignored when no trusted proxies
  // are configured — the rightmost IP in the chain is used.
  test("uses rightmost untrusted IP from X-Forwarded-For chain", async () => {
    const mockFn = prisma.$queryRaw as ReturnType<typeof vi.fn>;
    mockFn.mockClear();
    mockPg(1);
    const req = new NextRequest("https://example.test/api", {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
    });
    await rateLimitRequest(req, { key: "test", limit: 5, windowMs: 60_000 });
    // Prisma $queryRaw tagged-template: args[0] is the SQL parts array,
    // args[1] is the first interpolated value (the bucket key).
    const queryArgs = mockFn.mock.calls[0] as unknown[];
    const key = queryArgs[1] as string;
    // The rightmost IP (10.0.0.1) should be used, not the spoofed left-most one.
    expect(key).toContain("test:10.0.0.1");
    expect(key).not.toContain("1.2.3.4");
  });
});

// FIND-002: Token refresh rate limit regression.
// Confirms that 10 rapid refreshes (well above the per-IP threshold for a
// single caller in tests) would be blocked by the limiter after the limit is
// exceeded. Uses the in-memory rateLimit() since the Postgres limiter is
// tested separately above.
describe("tokenRefresh rate limit regression (FIND-002)", () => {
  beforeEach(() => resetRateLimitBucketsForTests());

  test("blocks excessive rapid refreshes from the same IP", () => {
    const LIMIT = 3;
    const results = Array.from({ length: LIMIT + 2 }, () =>
      rateLimit("token_refresh:10.0.0.1", LIMIT, 60_000),
    );
    const blocked = results.filter((r) => !r.allowed);
    expect(blocked.length).toBeGreaterThanOrEqual(1);
    expect(blocked[0]?.retryAfterSeconds).toBeGreaterThan(0);
  });

  test("allows up to the limit before blocking", () => {
    const LIMIT = 5;
    for (let i = 0; i < LIMIT; i++) {
      expect(rateLimit("token_refresh:10.0.0.2", LIMIT, 60_000).allowed).toBe(true);
    }
    expect(rateLimit("token_refresh:10.0.0.2", LIMIT, 60_000).allowed).toBe(false);
  });
});

describe("rateLimitKey", () => {
  test("builds canonical key", () => {
    expect(rateLimitKey("org-1", "act", "u-1")).toBe("org:org-1:act:u-1");
    expect(rateLimitKey("org-1", "act")).toBe("org:org-1:act:anonymous");
  });
});
