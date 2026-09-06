/**
 * Stalled-calculation-run sweep. A run large enough to need multiple chunks
 * (see lib/calculation/run-worker.ts) is normally driven to completion by
 * the calculations page polling its continue endpoint while a user has the
 * tab open. This route is the fallback for a run nobody's actively
 * watching — a closed tab, a lost connection, a chunk-holder that crashed
 * mid-chunk — so a large run doesn't sit "running" indefinitely with no one
 * ever calling processCalculationRun() again.
 *
 * Call this on a schedule (recommended: every 1-2 minutes, since a stalled
 * run is only reclaimable once its heartbeat is older than LOCK_STALE_MS):
 * GitHub Actions: * * * * *  (cron minimum is usually 5m; use an external
 *   service below for true 1-minute granularity)
 * Vercel Crons: POST https://your-domain.com/api/admin/schedule/advance-calculation-runs every 1m
 * EasyCron: https://your-domain.com/api/admin/schedule/advance-calculation-runs?secret=YOUR_CRON_SECRET every 1m
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dispatchCalculation } from "@/lib/jobs/dispatch";

// Matches run-worker.ts's LOCK_STALE_MS: only reclaim a run whose last
// chunk-holder hasn't heartbeated in at least this long, so this sweep
// never races an invocation that's still actively working.
const LOCK_STALE_MS = 90_000;
// Bound total work per invocation: each dispatchCalculation() call is
// itself bounded (~45s, see REQUEST_TIME_BUDGET_MS), so cap how many
// stalled runs one sweep advances rather than risk this route's own
// timeout — remaining runs are simply picked up by the next scheduled tick.
const MAX_RUNS_PER_SWEEP = 3;

async function advanceStalledRuns() {
  const staleBefore = new Date(Date.now() - LOCK_STALE_MS);
  const stalled = await prisma.calculationRun.findMany({
    where: {
      status: "running",
      OR: [{ processingLockedAt: null }, { processingLockedAt: { lt: staleBefore } }],
    },
    select: { id: true, organizationId: true },
    orderBy: { lastProgressAt: "asc" },
    take: MAX_RUNS_PER_SWEEP,
  });

  const results = [];
  for (const run of stalled) {
    try {
      await dispatchCalculation({ calculationRunId: run.id, orgId: run.organizationId });
      results.push({ calculationRunId: run.id, status: "advanced" });
    } catch (err) {
      results.push({
        calculationRunId: run.id,
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { checked: stalled.length, results };
}

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || !cronSecret || cronSecret !== expectedSecret) {
    console.warn("[advance-calculation-runs] Unauthorized cron call attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await advanceStalledRuns();
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[advance-calculation-runs] Sweep failed:", err);
    return NextResponse.json(
      {
        error: "Failed to advance stalled calculation runs",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
