import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createActivityRecordSchema } from "@/lib/validation/org";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const records = await prisma.activityRecord.findMany({
      where: { organizationId: orgId },
      include: {
        reportingPeriod: { select: { id: true, label: true } },
        emissionCategory: { select: { id: true, scope: true, name: true } },
        facility: { select: { id: true, name: true } },
        businessUnit: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(records);
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
    const body = createActivityRecordSchema.parse(await req.json());

    const [period, category, facility, businessUnit] = await Promise.all([
      prisma.reportingPeriod.findFirst({
        where: { id: body.reportingPeriodId, organizationId: orgId },
        select: { id: true },
      }),
      prisma.emissionCategory.findUnique({
        where: { id: body.emissionCategoryId },
        select: { id: true },
      }),
      body.facilityId
        ? prisma.facility.findFirst({
            where: { id: body.facilityId, organizationId: orgId },
            select: { id: true },
          })
        : Promise.resolve(null),
      body.businessUnitId
        ? prisma.businessUnit.findFirst({
            where: { id: body.businessUnitId, organizationId: orgId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (!period) {
      return apiError("INVALID_REPORTING_PERIOD", "Reporting period does not belong to this organisation.", 422);
    }
    if (!category) {
      return apiError("INVALID_EMISSION_CATEGORY", "Emission category does not exist.", 422);
    }
    if (body.facilityId && !facility) {
      return apiError("INVALID_FACILITY", "Facility does not belong to this organisation.", 422);
    }
    if (body.businessUnitId && !businessUnit) {
      return apiError("INVALID_BUSINESS_UNIT", "Business unit does not belong to this organisation.", 422);
    }

    const record = await prisma.activityRecord.create({
      data: {
        organizationId: orgId,
        reportingPeriodId: body.reportingPeriodId,
        emissionCategoryId: body.emissionCategoryId,
        activityDate: body.activityDate ? new Date(body.activityDate) : undefined,
        amount: body.amount,
        unit: body.unit,
        sourceDescription: body.sourceDescription,
        facilityId: body.facilityId,
        businessUnitId: body.businessUnitId,
        supplierName: body.supplierName,
        country: body.country,
        reviewStatus: body.reviewStatus,
        evidenceStatus: body.evidenceStatus,
        assumptionNotes: body.assumptionNotes,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.created",
      resourceType: "activity_record",
      resourceId: record.id,
      metadata: {
        amount: record.amount.toString(),
        unit: record.unit,
        reviewStatus: record.reviewStatus,
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
