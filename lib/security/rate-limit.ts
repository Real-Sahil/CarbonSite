// Sync in-memory rate limiting for Next.js middleware (Edge Runtime).
// Single-process fixed window. Acceptable at MVP scale; replace with an
// edge KV store (Cloudflare KV / Durable Objects) when horizontally scaled.
//
// Async Postgres-backed rate limiting is in rate-limit-async.ts (so Prisma
// doesn't get bundled into the middleware Edge Function).

import { NextRequest, NextResponse } from "next/server";
import { resolveClientIp } from "./client-ip";

// ── Sync in-memory (Edge-compatible) ─────────────────────────────────────────

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


// Canonical key builder — org + action + optional user.
export function rateLimitKey(orgId: string, action: string, userId?: string) {
  return ["org", orgId, action, userId ?? "anonymous"].join(":");
}

// Test helper — clears only the in-memory store (unit tests don't hit Postgres).
export function resetRateLimitBucketsForTests() {
  store.clear();
}

// Route-class policies.
export const POLICIES = {
  // Auth endpoints: 5 attempts per 15 minutes per IP.
  auth: { limit: 5, windowMs: 15 * 60_000 },
  // Mobile session refresh: many field workers can share one site NAT IP,
  // so this is looser than `auth` but still bounded.
  tokenRefresh: { limit: 60, windowMs: 15 * 60_000 },
  // Evidence/import uploads: sized for a crew draining offline photo queues.
  upload: { limit: 120, windowMs: 60_000 },
  mutation: { limit: 120, windowMs: 60_000 },
  read: { limit: 600, windowMs: 60_000 },
} as const;

// Clear in-memory lockout for account (used after successful login)
export function clearAccountLockout(email: string) {
  const key = `login:${email.toLowerCase()}`;
  store.delete(key);
}

