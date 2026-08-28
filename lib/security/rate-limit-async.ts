// Async rate limiting for Node.js route handlers with Redis + Postgres fallback.
// Separated from rate-limit.ts to prevent Prisma from being bundled into the middleware Edge Function.
// Redis (if available) provides persistence across serverless cold starts;
// Postgres fallback ensures rate limiting works even without Redis.

import { NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";
import { prisma } from "@/lib/db";
import { securityLogger } from "@/lib/logger";
import { resolveClientIp } from "./client-ip";
import type { RateLimitResult } from "./rate-limit";

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  if (!process.env.REDIS_URL) {
    return null;
  }

  try {
    if (!redisClient) {
      redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: false,
        enableOfflineQueue: false,
        connectTimeout: 5000,
        retryStrategy: (times) => Math.min(times * 50, 2000),
      });

      redisClient.on("error", (err) => {
        securityLogger.warn("Redis error, falling back to Postgres", {
          error: err instanceof Error ? err.message : String(err),
          code: (err as any).code || "UNKNOWN",
        });
      });
    }

    return redisClient;
  } catch (error) {
    securityLogger.warn("Failed to initialize Redis", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

async function rateLimitRedis(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const redisKey = `rl:${key}`;
    const count = await redis.incr(redisKey);

    if (count === 1) {
      await redis.expire(redisKey, Math.ceil(windowMs / 1000));
    }

    const ttl = await redis.ttl(redisKey);
    const retryAfterSeconds = Math.max(1, ttl <= 0 ? Math.ceil(windowMs / 1000) : ttl);

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds,
    };
  } catch (error) {
    securityLogger.warn("Redis rate limit check failed, falling back to Postgres", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

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
// Tries Redis first (if available) for persistence across cold starts,
// then falls back to Postgres (FIND-001).
// Resolves the real client IP, ignoring spoofed X-Forwarded-For entries from
// untrusted sources (FIND-008).
export async function rateLimitRequest(
  req: NextRequest,
  opts: { key: string; limit: number; windowMs: number },
): Promise<NextResponse | null> {
  const ip = resolveClientIp(req);
  const fullKey = `${opts.key}:${ip}`;

  // Try Redis first (persistent across cold starts)
  let result = await rateLimitRedis(fullKey, opts.limit, opts.windowMs);

  // Fall back to Postgres if Redis unavailable
  if (!result) {
    result = await rateLimitPg(fullKey, opts.limit, opts.windowMs);
  }

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

  // Try Redis first
  let result = await rateLimitRedis(key, maxAttempts, windowMs);

  // Fall back to Postgres
  if (!result) {
    result = await rateLimitPg(key, maxAttempts, windowMs);
  }

  return !result.allowed;
}

export async function isAccountLocked(email: string): Promise<boolean> {
  const maxAttempts = 5;
  const key = `login:${email.toLowerCase()}`;
  const redis = getRedisClient();

  // Check Redis first
  if (redis) {
    try {
      const redisKey = `rl:${key}`;
      const count = await redis.get(redisKey);
      if (count) {
        return Number(count) > maxAttempts;
      }
    } catch (error) {
      securityLogger.warn("Redis login rate check failed, falling back to Postgres", {
        email,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fall back to Postgres
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
