import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { dispatchCalculation } from "@/lib/jobs/dispatch";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
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
    const limited = rateLimit(req, {
      key: rateLimitKey(orgId, "calculation-runs", session.user.id),
      limit: 10,
      windowMs: 60_000,
    });
    if (limited) return limited;
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

    const approvedRecords = await prisma.activityRecord.findMany({
      where: {
        organizationId: orgId,
        reportingPeriodId: body.reportingPeriodId,
        reviewStatus: "approved",
      },
      select: {
        id: true,
        updatedAt: true,
        amount: true,
        unit: true,
        emissionCategoryId: true,
        facilityId: true,
        businessUnitId: true,
        country: true,
        distanceAmount: true,
        distanceUnit: true,
        routeDistanceId: true,
      },
      orderBy: { id: "asc" },
    });
    const approvedRecordFingerprint = createHash("sha256")
      .update(
        JSON.stringify(
          approvedRecords.map((record) => ({
            id: record.id,
            updatedAt: record.updatedAt.toISOString(),
            amount: record.amount.toString(),
            unit: record.unit,
            emissionCategoryId: record.emissionCategoryId,
            facilityId: record.facilityId,
            businessUnitId: record.businessUnitId,
            country: record.country,
            distanceAmount: record.distanceAmount?.toString() ?? null,
            distanceUnit: record.distanceUnit,
            routeDistanceId: record.routeDistanceId,
          })),
        ),
      )
      .digest("hex");

    const triggerHash = createHash("sha256")
      .update([
        orgId,
        body.reportingPeriodId,
        body.methodologyVersionId,
        body.factorLibraryId,
        approvedRecordFingerprint,
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

    const processingMode =
      run.status === "queued"
        ? await dispatchCalculation({ orgId, calculationRunId: run.id })
        : "existing";
    const currentRun =
      (await prisma.calculationRun.findUnique({ where: { id: run.id } })) ?? run;

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
        processingMode,
        approvedRecordCount: approvedRecords.length,
        approvedRecordFingerprint,
      },
    });

    return NextResponse.json(currentRun, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
