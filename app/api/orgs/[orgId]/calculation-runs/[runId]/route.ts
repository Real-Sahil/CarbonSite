import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string; runId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, runId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const run = await prisma.calculationRun.findUnique({
      where: { id: runId },
      include: {
        reportingPeriod: { select: { label: true } },
        factorLibrary: { select: { name: true, version: true } },
        methodologyVersion: { select: { name: true, gwpVersion: true } },
        triggeredBy: { select: { name: true, email: true } },
        _count: { select: { calculations: true } },
      },
    });

    if (!run || run.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Calculation run not found.", 404);
    }

    return NextResponse.json(run);
  } catch (err) {
    return handleRouteError(err);
  }
}

// PATCH /api/orgs/[orgId]/calculation-runs/[runId]
// Body: { action: "cancel" }
// Allows admins to cancel a run that is stuck in "queued" or "running" state.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, runId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const body = await req.json().catch(() => ({}));
    if (body?.action !== "cancel") {
      return apiError("INVALID_ACTION", "Only action=cancel is supported.", 400);
    }

    const run = await prisma.calculationRun.findUnique({
      where: { id: runId },
      select: { id: true, organizationId: true, status: true },
    });

    if (!run || run.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Calculation run not found.", 404);
    }

    if (run.status !== "queued" && run.status !== "running") {
      return apiError(
        "INVALID_STATUS",
        `Cannot cancel a run with status "${run.status}".`,
        422,
      );
    }

    const updated = await prisma.calculationRun.update({
      where: { id: runId },
      data: { status: "failed", finishedAt: new Date(), errorMessage: "Cancelled by administrator." },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "calculation.run_cancelled",
      resourceType: "calculation_run",
      resourceId: runId,
      metadata: { previousStatus: run.status },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
