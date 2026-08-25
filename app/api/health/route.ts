import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Health check endpoint for monitoring services
 * Used by Grafana and load balancers to verify service availability
 */
export async function GET() {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1 as health`;

    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        checks: {
          database: "ok",
          uptime: process.uptime(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        checks: {
          database: "error",
          error: errorMessage,
        },
      },
      { status: 503 }
    );
  }
}
