// Async Postgres-backed rate limiting for Node.js route handlers.
// Separated from rate-limit.ts to prevent Prisma from being bundled into the middleware Edge Function.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveClientIp } from "./client-ip";
import type { RateLimitResult } from "./rate-limit";

async function rateLimitPg(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  // Atomic fixed-window upsert. ON CONFLICT resets the window when it has
  // elapsed; otherwise increments count and returns the current value.
  const windowSecs = windowMs / 1000;
  let rows: Array<{ count: number; reset_at: Date }>;
  try {
    rows = await prisma.$queryRaw<Array<{ count: number; reset_at: Date }>>`
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
  } catch {
    // Table may not exist yet (migration pending). Degrade to allow-all so
    // legitimate traffic is never blocked by a missing schema.
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

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

// Per-account login lockout (closes distributed-IP bypass gap)
export async function recordFailedLogin(email: string): Promise<boolean> {
  const windowMs = 30 * 60_000; // 30-minute lockout window
  const maxAttempts = 5;
  const key = `login:${email.toLowerCase()}`;
  const result = await rateLimitPg(key, maxAttempts, windowMs);
  return !result.allowed;
}

export async function isAccountLocked(email: string): Promise<boolean> {
  const windowMs = 30 * 60_000;
  const maxAttempts = 5;
  const key = `login:${email.toLowerCase()}`;
  try {
    const rows = await prisma.$queryRaw<Array<{ count: number; reset_at: Date }>>`
      SELECT count, reset_at FROM rate_limit_buckets WHERE key = ${key} AND reset_at > NOW()
    `;
    if (!rows.length) return false;
    const row = rows[0]!;
    return Number(row.count) > maxAttempts;
  } catch {
    return false;
  }
}
