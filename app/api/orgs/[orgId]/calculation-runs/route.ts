import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createCalculationRunSchema } from "@/lib/validation/records";
import { createHash } from "crypto";

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

    // Idempotency — same org + period + methodology + library = same run
    const triggerHash = createHash("sha256")
      .update(`${orgId}:${body.reportingPeriodId}:${body.methodologyVersionId}:${body.factorLibraryId}`)
      .digest("hex");

    const existing = await prisma.calculationRun.findUnique({
      where: { triggerHash },
      select: { id: true, status: true },
    });
    if (existing && (existing.status === "queued" || existing.status === "running")) {
      return NextResponse.json(existing, { status: 200 });
    }

    const run = await prisma.calculationRun.create({
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

    // Enqueue the background job
    const { getBoss } = await import("@/lib/jobs/boss");
    const boss = await getBoss();
    await boss.send("calculations", { calculationRunId: run.id, orgId });

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
