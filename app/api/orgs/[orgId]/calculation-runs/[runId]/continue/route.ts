export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { dispatchCalculation } from "@/lib/jobs/dispatch";

// Allow enough headroom for one more inline chunk pass (see
// lib/calculation/run-worker.ts's REQUEST_TIME_BUDGET_MS) within Vercel's
// function limit.
export const maxDuration = 60;

type Params = { params: Promise<{ orgId: string; runId: string }> };

// POST /api/orgs/[orgId]/calculation-runs/[runId]/continue
//
// A run large enough that its first invocation didn't finish within
// REQUEST_TIME_BUDGET_MS stays "running" with processedRecordCount <
// totalRecordCount — safe to resume from here. The calculations page polls
// this while a run is in that state (see calculation-run-continuation.tsx);
// the stalled-run sweep (app/api/admin/schedule/advance-calculation-runs)
// is the fallback if nobody's tab is open to drive it.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, runId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const run = await prisma.calculationRun.findUnique({
      where: { id: runId },
      select: { id: true, organizationId: true, status: true, totalRecordCount: true, processedRecordCount: true },
    });
    if (!run || run.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Calculation run not found.", 404);
    }

    if (run.status === "running" && (run.totalRecordCount == null || run.processedRecordCount < run.totalRecordCount)) {
      await dispatchCalculation({ calculationRunId: runId, orgId }).catch(async (err) => {
        console.error(`[calculations] continue of run ${runId} failed:`, err);
        await prisma.calculationRun.update({
          where: { id: runId, status: "running" },
          data: {
            status: "failed",
            finishedAt: new Date(),
            errorMessage: err instanceof Error ? err.message.slice(0, 500) : "Continuation failed.",
          },
        }).catch(() => {});
      });
    }

    const updated = await prisma.calculationRun.findUnique({
      where: { id: runId },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        finishedAt: true,
        totalRecordCount: true,
        processedRecordCount: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
