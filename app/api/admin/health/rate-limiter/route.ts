// Admin health check endpoint for rate limiter status.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { securityLogger } from "@/lib/logger";

/**
 * GET /api/admin/health/rate-limiter
 *
 * Returns Postgres rate-limiter bucket table connectivity.
 * Response:
 * {
 *   "status": "healthy" | "unhealthy",
 *   "backend": "postgres",
 *   "bucketCount": number,
 *   "timestamp": ISO string
 * }
 */
export async function GET() {
  try {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM rate_limit_buckets
    `;
    const bucketCount = Number(rows[0]?.count ?? 0);

    securityLogger.info("Rate limiter health check", { backend: "postgres", bucketCount });

    return NextResponse.json({
      status: "healthy",
      backend: "postgres",
      bucketCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    securityLogger.error("Rate limiter health check failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { status: "unhealthy", error: "Health check failed", timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}
