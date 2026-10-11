/**
 * Stalled-import sweep. An import is parsed inside the request that uploaded it
 * (JOB_PROCESSING_MODE=inline). A function timeout or a transient failure leaves
 * the batch in "parsing" with nothing left to finish it. This route finds those
 * batches once they have been quiet for IMPORT_STALE_MS, parses them again while
 * attempts remain (lib/imports/retry.ts), and fails the last attempt.
 *
 * Scheduled by Supabase pg_cron (migration 20261014000096), every 5 minutes.
 * In worker mode pg-boss owns the queue and its retries, so this sweep does nothing.
 */

import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { prisma } from "@/lib/db";
import { dispatchImport, dispatchNotification } from "@/lib/jobs/dispatch";
import { IMPORT_STALE_MS, decideStalledImport } from "@/lib/imports/retry";

// Each retry parses a whole file inside this invocation, so take one per sweep.
// A backlog drains one batch per tick.
const MAX_BATCHES_PER_SWEEP = 1;

async function sweepStalledImports() {
  // In worker mode pg-boss owns the queue and its retries; a second parse here would duplicate it.
  if (process.env.JOB_PROCESSING_MODE === "worker") {
    return { checked: 0, results: [], skipped: "worker mode: pg-boss owns retries" };
  }

  const now = new Date();
  const staleBefore = new Date(now.getTime() - IMPORT_STALE_MS);
  const stalled = await prisma.importBatch.findMany({
    where: { state: "parsing", updatedAt: { lt: staleBefore } },
    select: { id: true, organizationId: true, state: true, processingAttempts: true, updatedAt: true, createdByUserId: true },
    orderBy: { updatedAt: "asc" },
    take: MAX_BATCHES_PER_SWEEP,
  });

  const results = [];
  for (const batch of stalled) {
    const decision = decideStalledImport(batch, now);
    if (decision === "skip") continue;

    // Claim the batch first: bumping updatedAt means an overlapping sweep sees it as live.
    const claim = await prisma.importBatch.updateMany({
      where: { id: batch.id, state: "parsing", updatedAt: { lt: staleBefore } },
      data: { updatedAt: now },
    });
    if (claim.count === 0) continue;

    try {
      if (decision === "fail") {
        await prisma.importBatch.updateMany({
          where: { id: batch.id, organizationId: batch.organizationId },
          data: { state: "failed" },
        });
        if (batch.createdByUserId) {
          await dispatchNotification({
            type: "import_failed",
            recipientUserId: batch.createdByUserId,
            orgId: batch.organizationId,
            resourceId: batch.id,
          });
        }
        results.push({ importBatchId: batch.id, status: "failed", attempts: batch.processingAttempts });
      } else {
        await dispatchImport({ importBatchId: batch.id, orgId: batch.organizationId });
        results.push({ importBatchId: batch.id, status: "retried", attempts: batch.processingAttempts + 1 });
      }
    } catch (err) {
      results.push({
        importBatchId: batch.id,
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { checked: stalled.length, results };
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    console.warn("[import-batches] Unauthorized cron call attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sweepStalledImports();
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[import-batches] Sweep failed:", err);
    return NextResponse.json(
      {
        error: "Failed to sweep stalled imports",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
