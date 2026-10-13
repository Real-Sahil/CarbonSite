// @vitest-environment node
/**
 * GET /api/public/supplier-invites/[token]/validate is public, so it is rate limited per client.
 * A limited client is answered before any invite lookup.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const db = vi.hoisted(() => ({ supplierInvite: { findUnique: vi.fn() } }));
const limit = vi.hoisted(() => ({ rateLimitRequest: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/security/rate-limit-async", () => ({ rateLimitRequest: limit.rateLimitRequest }));

import { GET } from "@/app/api/public/supplier-invites/[token]/validate/route";

const request = () => new NextRequest("http://localhost/api/public/supplier-invites/tok-1/validate");
const ctx = { params: Promise.resolve({ token: "tok-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  limit.rateLimitRequest.mockResolvedValue(null);
});

describe("public supplier invite validation", () => {
  it("a client over the limit gets the limiter's 429 and no invite lookup", async () => {
    limit.rateLimitRequest.mockResolvedValue(NextResponse.json({ code: "RATE_LIMITED" }, { status: 429 }));
    const res = await GET(request(), ctx);
    expect(res.status).toBe(429);
    expect(db.supplierInvite.findUnique).not.toHaveBeenCalled();
  });

  it("limits under its own key, 20 requests per 15 minutes", async () => {
    db.supplierInvite.findUnique.mockResolvedValue(null);
    const res = await GET(request(), ctx);
    expect(res.status).toBe(404);
    expect(limit.rateLimitRequest).toHaveBeenCalledWith(expect.any(NextRequest), {
      key: "public-supplier-invite-validate",
      limit: 20,
      windowMs: 15 * 60_000,
    });
  });
});
