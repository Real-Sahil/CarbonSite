import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createCalculationRunSchema } from "@/lib/validation/records";
import { dispatchCalculation } from "@/lib/jobs/dispatch";
import { createHash } from "crypto";

// Inline job mode processes the run inside this request — allow time for it.
export const maxDuration = 60;

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const runs = await prisma.calculationRun.findMany({
      where: { organizationId: orgId },
      include: {
        reportingPeriod: { select: { label: true } },
        factorLibrary: { select: { name: true, version: true } },
        methodologyVersion: { select: { name: true, gwpVersion: true } },
        triggeredBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ data: runs });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const body = createCalculationRunSchema.parse(await req.json());

    // Verify period belongs to this org
    const period = await prisma.reportingPeriod.findUnique({
      where: { id: body.reportingPeriodId },
      select: { organizationId: true, status: true },
    });
    if (!period || period.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Reporting period not found.", 404);
    }

    // Verify methodology version exists
    const methodology = await prisma.methodologyVersion.findUnique({
      where: { id: body.methodologyVersionId },
      select: { id: true },
    });
    if (!methodology) {
      return apiError("NOT_FOUND", "Methodology version not found.", 404);
    }

    // Verify factor library exists
    const factorLibrary = await prisma.factorLibrary.findUnique({
      where: { id: body.factorLibraryId },
      select: { id: true },
    });
    if (!factorLibrary) {
      return apiError("NOT_FOUND", "Factor library not found.", 404);
    }

    // Double-trigger guard: identical parameters within the same minute
    // dedupe to one run. The hash must NOT be permanent — re-running the
    // same period/library after new data arrives is the normal
    // recalculation flow (a permanent unique hash made every recalc 500).
    const minuteBucket = Math.floor(Date.now() / 60_000);
    const triggerHash = createHash("sha256")
      .update(`${orgId}:${body.reportingPeriodId}:${body.methodologyVersionId}:${body.factorLibraryId}:${minuteBucket}`)
      .digest("hex");

    // Never run two calculations for the same period concurrently.
    const inFlight = await prisma.calculationRun.findFirst({
      where: {
        organizationId: orgId,
        reportingPeriodId: body.reportingPeriodId,
        status: { in: ["queued", "running"] },
      },
      select: { id: true, status: true },
    });
    if (inFlight) {
      return NextResponse.json(inFlight, { status: 200 });
    }

    let run;
    try {
      run = await prisma.calculationRun.create({
        data: {
          organizationId: orgId,
          reportingPeriodId: body.reportingPeriodId,
          methodologyVersionId: body.methodologyVersionId,
          factorLibraryId: body.factorLibraryId,
          triggeredByUserId: session.user.id,
          triggerHash,
          status: "queued",
        },
      });
    } catch (createErr) {
      // Same-minute double-click raced past the in-flight check.
      const existing = await prisma.calculationRun.findUnique({
        where: { triggerHash },
        select: { id: true, status: true },
      });
      if (existing) return NextResponse.json(existing, { status: 200 });
      throw createErr;
    }

    // Inline-mode aware: processes the run now when no worker is deployed,
    // enqueues to pg-boss when JOB_PROCESSING_MODE=worker. Failures are
    // recorded on the run itself (status + errorMessage), not thrown here.
    // Belt-and-suspenders: if dispatch throws before updating the run status
    // (e.g. the initial "running" update failed), explicitly mark it failed
    // so it never stays stuck at "queued" forever.
    await dispatchCalculation({ calculationRunId: run.id, orgId }).catch(async (err) => {
      console.error(`[calculations] run ${run.id} failed:`, err);
      await prisma.calculationRun.update({
        where: { id: run.id, status: "queued" },
        data: {
          status: "failed",
          finishedAt: new Date(),
          errorMessage: err instanceof Error ? err.message.slice(0, 500) : "Dispatch failed.",
        },
      }).catch(() => {});
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "calculation.run_triggered",
      resourceType: "calculation_run",
      resourceId: run.id,
      metadata: { reportingPeriodId: body.reportingPeriodId },
    });

    return NextResponse.json(run, { status: 202 });
  } catch (err) {
    return handleRouteError(err);
  }
}
