/**
 * Stalled-report sweep. A report renders inside the request that asked for it
 * (JOB_PROCESSING_MODE=inline). A function timeout or a kill leaves it in
 * "queued" or "generating" with nothing left to finish it. This route finds
 * those once they have been quiet for REPORT_STALE_MS, renders them again while
 * attempts remain (lib/reports/retry.ts), and fails the last attempt.
 *
 * Scheduled by Supabase pg_cron (migration 20261015000098), every 5 minutes.
 * In worker mode pg-boss owns the queue and its retries, so this sweep does nothing.
 */

import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { prisma } from "@/lib/db";
import { dispatchReport } from "@/lib/jobs/dispatch";
import { REPORT_STALE_MS, decideStalledReport, MAX_REPORT_ATTEMPTS } from "@/lib/reports/retry";

// Each retry renders a whole report inside this invocation, so take one per sweep.
const MAX_REPORTS_PER_SWEEP = 1;

async function sweepStalledReports() {
  if (process.env.JOB_PROCESSING_MODE === "worker") {
    return { checked: 0, results: [], skipped: "worker mode: pg-boss owns retries" };
  }

  const now = new Date();
  const staleBefore = new Date(now.getTime() - REPORT_STALE_MS);
  const stalled = await prisma.report.findMany({
    where: { status: { in: ["queued", "generating"] }, updatedAt: { lt: staleBefore } },
    select: { id: true, organizationId: true, snapshotId: true, status: true, processingAttempts: true, updatedAt: true },
    orderBy: { updatedAt: "asc" },
    take: MAX_REPORTS_PER_SWEEP,
  });

  const results = [];
  for (const report of stalled) {
    const decision = decideStalledReport(report, now);
    if (decision === "skip") continue;

    // Claim first: bumping updatedAt means an overlapping sweep sees it as live.
    const claim = await prisma.report.updateMany({
      where: { id: report.id, status: report.status, updatedAt: { lt: staleBefore } },
      data: { updatedAt: now },
    });
    if (claim.count === 0) continue;

    try {
      if (decision === "fail") {
        await prisma.report.updateMany({
          where: { id: report.id, organizationId: report.organizationId },
          data: {
            status: "failed",
            errorMessage: `Interrupted ${MAX_REPORT_ATTEMPTS} times before rendering finished. Request the report again.`,
          },
        });
        results.push({ reportId: report.id, status: "failed", attempts: report.processingAttempts });
      } else {
        await dispatchReport({ reportId: report.id, orgId: report.organizationId, snapshotId: report.snapshotId });
        results.push({ reportId: report.id, status: "retried", attempts: report.processingAttempts + 1 });
      }
    } catch (err) {
      results.push({
        reportId: report.id,
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { checked: stalled.length, results };
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    console.warn("[reports-sweep] Unauthorized cron call attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sweepStalledReports();
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[reports-sweep] Sweep failed:", err);
    return NextResponse.json(
      {
        error: "Failed to sweep stalled reports",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
