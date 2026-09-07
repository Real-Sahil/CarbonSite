/**
 * Cron handler: process due calculation schedules.
 *
 * Call on a schedule — recommended: every hour.
 * Vercel Cron: add to vercel.json "crons" array (Pro plan).
 * External: POST https://your-domain/api/admin/schedule/calculation-schedules
 *           with header X-Cron-Secret: $CRON_SECRET  (or ?secret=$CRON_SECRET)
 *
 * The cron finds every enabled CalculationSchedule whose nextRunAt <= now,
 * creates a CalculationRun for each using the latest seeded methodology +
 * factor library, dispatches it inline (Vercel default) or to pg-boss
 * (when JOB_PROCESSING_MODE=worker), and advances nextRunAt.
 */

import { NextRequest, NextResponse } from "next/server";
import { processDueSchedules } from "@/lib/scheduling/calculation-scheduler";

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  const expected = process.env.CRON_SECRET;

  if (!expected || !cronSecret || cronSecret !== expected) {
    console.warn("[cron/calculation-schedules] Unauthorized call");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processDueSchedules();
    console.log(`[cron/calculation-schedules] processed=${result.processed} errors=${result.errors}`);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/calculation-schedules] Fatal error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
