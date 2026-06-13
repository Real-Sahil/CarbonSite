// Fixed-window in-memory rate limiter. Single canonical module — lib/rate-limit.ts deleted.
// If scaled horizontally, replace store with Upstash Redis; public API stays the same.

import { NextRequest, NextResponse } from "next/server";

type Window = { count: number; resetAt: number };

const store = new Map<string, Window>();

const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, win] of store) {
    if (win.resetAt <= now) store.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

// Key-based rate limit used by middleware and direct callers.
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const win = store.get(key);
  if (!win || win.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  win.count += 1;
  if (win.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((win.resetAt - now) / 1000),
    };
  }
  return { allowed: true, remaining: limit - win.count, retryAfterSeconds: 0 };
}

// Request-scoped wrapper used by API route handlers.
// Combines a semantic key (org+action+user) with the client IP.
export function rateLimitRequest(
  req: NextRequest,
  opts: { key: string; limit: number; windowMs: number },
): NextResponse | null {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "local";
  const result = rateLimit(`${opts.key}:${ip}`, opts.limit, opts.windowMs);
  if (result.allowed) return null;
  return NextResponse.json(
    { code: "RATE_LIMITED", message: "Too many requests. Please wait and try again." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}

// Canonical key builder — org + action + optional user.
export function rateLimitKey(orgId: string, action: string, userId?: string) {
  return ["org", orgId, action, userId ?? "anonymous"].join(":");
}

// Test helper.
export function resetRateLimitBucketsForTests() {
  store.clear();
}

// Route-class policies.
export const POLICIES = {
  auth: { limit: 20, windowMs: 60_000 },
  upload: { limit: 30, windowMs: 60_000 },
  mutation: { limit: 120, windowMs: 60_000 },
  read: { limit: 600, windowMs: 60_000 },
} as const;
