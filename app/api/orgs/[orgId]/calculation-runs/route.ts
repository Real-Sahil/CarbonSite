import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { enqueueCalculation } from "@/lib/jobs/queues";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createCalculationRunSchema } from "@/lib/validation/org";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const runs = await prisma.calculationRun.findMany({
      where: { organizationId: orgId },
      include: {
        reportingPeriod: { select: { id: true, label: true } },
        methodologyVersion: { select: { id: true, name: true, gwpVersion: true } },
        factorLibrary: { select: { id: true, name: true, version: true } },
        triggeredBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(runs);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");
    const body = createCalculationRunSchema.parse(await req.json());

    const [period, methodology, factorLibrary] = await Promise.all([
      prisma.reportingPeriod.findFirst({
        where: { id: body.reportingPeriodId, organizationId: orgId },
        select: { id: true },
      }),
      prisma.methodologyVersion.findUnique({
        where: { id: body.methodologyVersionId },
        select: { id: true, name: true },
      }),
      prisma.factorLibrary.findUnique({
        where: { id: body.factorLibraryId },
        select: { id: true, name: true, version: true },
      }),
    ]);

    if (!period) {
      return apiError("INVALID_REPORTING_PERIOD", "Reporting period does not belong to this organisation.", 422);
    }
    if (!methodology) {
      return apiError("INVALID_METHODOLOGY", "Methodology version does not exist.", 422);
    }
    if (!factorLibrary) {
      return apiError("INVALID_FACTOR_LIBRARY", "Factor library does not exist.", 422);
    }

    const triggerHash = createHash("sha256")
      .update([
        orgId,
        body.reportingPeriodId,
        body.methodologyVersionId,
        body.factorLibraryId,
        "approved-records",
      ].join(":"))
      .digest("hex");

    const run = await prisma.calculationRun.upsert({
      where: { triggerHash },
      update: {},
      create: {
        organizationId: orgId,
        reportingPeriodId: body.reportingPeriodId,
        methodologyVersionId: body.methodologyVersionId,
        factorLibraryId: body.factorLibraryId,
        triggeredByUserId: session.user.id,
        status: "queued",
        triggerHash,
      },
    });

    if (run.status === "queued") {
      await enqueueCalculation({ orgId, calculationRunId: run.id });
    }

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "calculation.run_triggered",
      resourceType: "calculation_run",
      resourceId: run.id,
      metadata: {
        reportingPeriodId: run.reportingPeriodId,
        methodologyVersionId: run.methodologyVersionId,
        factorLibraryId: run.factorLibraryId,
      },
    });

    return NextResponse.json(run, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
