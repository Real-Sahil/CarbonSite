import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  windowMs: number; // milliseconds
  maxRequests: number;
  keyGenerator?: (request: NextRequest) => string;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
};

// In-memory store for rate limit tracking
// In production, this should use Redis or database
const rateLimitStore = new Map<
  string,
  { count: number; resetTime: number }
>();

/**
 * Rate limiting middleware for API routes.
 * Tracks requests per key (user ID, IP, or custom) within a time window.
 */
export function withRateLimit(config: Partial<RateLimitConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config };

  const keyGenerator =
    config.keyGenerator ||
    ((request: NextRequest) => {
      return (
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown"
      );
    });

  return async (handler: Function) => {
    return async (request: NextRequest, ...args: unknown[]) => {
      const key = keyGenerator(request);
      const now = Date.now();

      let record = rateLimitStore.get(key);

      // Clean up expired entries
      if (record && record.resetTime < now) {
        rateLimitStore.delete(key);
        record = undefined;
      }

      if (!record) {
        rateLimitStore.set(key, {
          count: 1,
          resetTime: now + finalConfig.windowMs,
        });
      } else {
        record.count++;

        if (record.count > finalConfig.maxRequests) {
          return NextResponse.json(
            {
              code: "RATE_LIMIT_EXCEEDED",
              message: "Too many requests. Please try again later.",
              retryAfter: Math.ceil(
                (record.resetTime - now) / 1000
              ),
            },
            {
              status: 429,
              headers: {
                "Retry-After": Math.ceil(
                  (record.resetTime - now) / 1000
                ).toString(),
              },
            }
          );
        }
      }

      return handler(request, ...args);
    };
  };
}

/**
 * Create a per-organization rate limit key generator.
 * Used for org-scoped endpoints to rate limit by org + user.
 */
export function createOrgKeyGenerator(
  getUserId: (request: NextRequest) => string | null
) {
  return (request: NextRequest) => {
    const userId = getUserId(request);
    const pathSegments = request.nextUrl.pathname.split("/");
    const orgId = pathSegments[2]; // /api/orgs/[orgId]/...

    if (!userId || !orgId) {
      return (
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown"
      );
    }

    return `${orgId}:${userId}`;
  };
}

/**
 * Cleanup function to periodically purge expired entries.
 * Call this periodically (e.g., every 5 minutes) to free memory.
 */
export function cleanupRateLimitStore() {
  const now = Date.now();
  const entriesToDelete: string[] = [];

  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetTime < now) {
      entriesToDelete.push(key);
    }
  }

  entriesToDelete.forEach((key) => rateLimitStore.delete(key));
  console.log(`[Rate Limit] Cleaned up ${entriesToDelete.length} expired entries`);
}
