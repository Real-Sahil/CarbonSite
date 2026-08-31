/**
 * Admin endpoint to manually trigger accounting sync for all connected orgs.
 * Call this 2x daily (e.g., via GitHub Actions, Vercel Crons, EasyCron, etc.)
 *
 * Cron Examples:
 * GitHub Actions: 0 6,18 * * * UTC (6am and 6pm UTC)
 * Vercel Crons: POST https://your-domain.com/api/admin/schedule/accounting-sync every 12h
 * EasyCron: https://your-domain.com/api/admin/schedule/accounting-sync?secret=YOUR_CRON_SECRET every 12h
 */

import { NextRequest, NextResponse } from "next/server";
import { scheduleAccountingSyncForAllOrgs } from "@/lib/jobs/schedulers/accounting-sync-scheduler";

export async function POST(req: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const cronSecret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || !cronSecret || cronSecret !== expectedSecret) {
    console.warn("[accounting-sync] Unauthorized cron call attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await scheduleAccountingSyncForAllOrgs();
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[accounting-sync] Failed to schedule sync:", err);
    return NextResponse.json(
      {
        error: "Failed to schedule accounting sync",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Allow GET for Vercel Crons and simple cron services
  return POST(req);
}
