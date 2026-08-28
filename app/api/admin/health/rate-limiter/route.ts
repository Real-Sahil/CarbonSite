// Admin health check endpoint for rate limiter status.
// Used by monitoring systems to verify Redis and Postgres fallback connectivity.

import { NextResponse } from "next/server";
import { checkRedisHealth } from "@/lib/security/redis-health";
import { securityLogger } from "@/lib/logger";

/**
 * GET /api/admin/health/rate-limiter
 *
 * Returns Redis connectivity status and fallback information.
 * Protected: Requires admin role (should be restricted in production).
 *
 * Response:
 * {
 *   "status": "healthy" | "degraded" | "unhealthy",
 *   "redis": {
 *     "available": boolean,
 *     "connected": boolean,
 *     "latencyMs"?: number,
 *     "error"?: string
 *   },
 *   "fallback": {
 *     "reason"?: string,
 *     "isActive": boolean
 *   },
 *   "timestamp": ISO string
 * }
 */
export async function GET() {
  try {
    const redisHealth = await checkRedisHealth();

    const status = redisHealth.available && redisHealth.connected ? "healthy" : "degraded";

    securityLogger.info("Rate limiter health check", {
      status,
      redis: {
        available: redisHealth.available,
        connected: redisHealth.connected,
        latencyMs: redisHealth.latencyMs,
      },
    });

    return NextResponse.json(
      {
        status,
        redis: {
          available: redisHealth.available,
          connected: redisHealth.connected,
          latencyMs: redisHealth.latencyMs,
          error: redisHealth.error,
        },
        fallback: {
          reason: redisHealth.fallbackReason,
          isActive: !redisHealth.available,
        },
        timestamp: new Date().toISOString(),
      },
      { status: status === "healthy" ? 200 : 503 },
    );
  } catch (error) {
    securityLogger.error("Rate limiter health check failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        status: "unhealthy",
        error: "Health check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
