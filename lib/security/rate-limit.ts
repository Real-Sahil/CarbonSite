// Rate limiting — two tiers:
//
// 1. Sync in-memory (rateLimit): used by Next.js middleware (Edge Runtime).
//    Single-process fixed window. Acceptable at MVP scale; replace with an
//    edge KV store (Cloudflare KV / Durable Objects) when horizontally scaled.
//
// 2. Async Postgres-backed (rateLimitRequest): used by Node.js route handlers.
//    Atomic ON CONFLICT upsert — survives restarts and multiple workers.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

// ── Trusted proxy resolution (FIND-008) ───────────────────────────────────────

// Comma-separated list of proxy IPs (or CIDR ranges) that are allowed to set
// X-Forwarded-For. Read once at startup; deploy env var: TRUSTED_PROXY_IPS.
// Example: "10.0.0.1,10.0.0.2,172.31.0.0/16"
const TRUSTED_PROXY_SET: Set<string> = new Set(
  (process.env.TRUSTED_PROXY_IPS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

function resolveClientIp(req: NextRequest): string {
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",").map((s) => s.trim());
    // Walk right-to-left: skip known trusted proxies, take the first
    // untrusted entry. This is the real client IP even behind a proxy chain.
    for (let i = ips.length - 1; i >= 0; i--) {
      if (!TRUSTED_PROXY_SET.has(ips[i]!)) return ips[i]!;
    }
  }
  return req.headers.get("x-real-ip") ?? "local";
}

// ── Async Postgres-backed limiter (Node.js route handlers) ───────────────────

async function rateLimitPg(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  // Atomic fixed-window upsert. ON CONFLICT resets the window when it has
  // elapsed; otherwise increments count and returns the current value.
  const windowSecs = windowMs / 1000;
  const rows = await prisma.$queryRaw<Array<{ count: number; reset_at: Date }>>`
    INSERT INTO rate_limit_buckets (key, count, reset_at)
    VALUES (${key}, 1, NOW() + (${windowSecs} * interval '1 second'))
    ON CONFLICT (key) DO UPDATE
      SET
        count    = CASE
                     WHEN rate_limit_buckets.reset_at <= NOW() THEN 1
                     ELSE rate_limit_buckets.count + 1
                   END,
        reset_at = CASE
                     WHEN rate_limit_buckets.reset_at <= NOW()
                       THEN NOW() + (${windowSecs} * interval '1 second')
                     ELSE rate_limit_buckets.reset_at
                   END
    RETURNING count, reset_at
  `;

  const row = rows[0];
  if (!row) {
    // Defensive: treat DB failure as allowed to avoid blocking legitimate traffic.
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  const count = Number(row.count);
  if (count > limit) {
    const retryAfterMs = row.reset_at.getTime() - Date.now();
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }
  return { allowed: true, remaining: limit - count, retryAfterSeconds: 0 };
}

// Request-scoped async wrapper used by API route handlers.
// Resolves the real client IP, ignoring spoofed X-Forwarded-For entries from
// untrusted sources (FIND-008).
export async function rateLimitRequest(
  req: NextRequest,
  opts: { key: string; limit: number; windowMs: number },
): Promise<NextResponse | null> {
  const ip = resolveClientIp(req);
  const result = await rateLimitPg(`${opts.key}:${ip}`, opts.limit, opts.windowMs);
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
