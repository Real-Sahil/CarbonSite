export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createActivityRecordSchema } from "@/lib/validation/records";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const url = new URL(_req.url);
    const cursor = url.searchParams.get("cursor");
    const periodId = url.searchParams.get("periodId");
    const categoryId = url.searchParams.get("categoryId");
    const reviewStatus = url.searchParams.get("reviewStatus");
    const take = 50;

    const where = {
      organizationId: orgId,
      ...(periodId ? { reportingPeriodId: periodId } : {}),
      ...(categoryId ? { emissionCategoryId: categoryId } : {}),
      ...(reviewStatus ? { reviewStatus: reviewStatus as never } : {}),
    };

    const [records, total] = await Promise.all([
      prisma.activityRecord.findMany({
        where,
        include: {
          reportingPeriod: { select: { label: true } },
          emissionCategory: { select: { scope: true, name: true, code: true } },
          facility: { select: { name: true } },
          businessUnit: { select: { name: true } },
          evidence: {
            include: {
              evidenceFile: { select: { id: true, filename: true } },
            },
          },
          _count: { select: { calculations: true } },
        },
        orderBy: { createdAt: "desc" },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      prisma.activityRecord.count({ where }),
    ]);

    const hasMore = records.length > take;
    const data = hasMore ? records.slice(0, take) : records;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return NextResponse.json({ data, nextCursor, total });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const body = createActivityRecordSchema.parse(await req.json());

    // Verify the reporting period belongs to this org
    const period = await prisma.reportingPeriod.findUnique({
      where: { id: body.reportingPeriodId },
      select: { organizationId: true, status: true },
    });
    if (!period || period.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Reporting period not found.", 404);
    }
    if (period.status === "locked") {
      return apiError("LOCKED", "Reporting period is locked.", 409);
    }

    // Verify facility belongs to this org if provided
    if (body.facilityId) {
      const facility = await prisma.facility.findUnique({
        where: { id: body.facilityId },
        select: { organizationId: true },
      });
      if (!facility || facility.organizationId !== orgId) {
        return apiError("NOT_FOUND", "Facility not found.", 404);
      }
    }

    // Verify business unit belongs to this org if provided
    if (body.businessUnitId) {
      const bu = await prisma.businessUnit.findUnique({
        where: { id: body.businessUnitId },
        select: { organizationId: true },
      });
      if (!bu || bu.organizationId !== orgId) {
        return apiError("NOT_FOUND", "Business unit not found.", 404);
      }
    }

    const record = await prisma.activityRecord.create({
      data: {
        organizationId: orgId,
        reportingPeriodId: body.reportingPeriodId,
        emissionCategoryId: body.emissionCategoryId,
        amount: body.amount,
        unit: body.unit,
        activityDate: body.activityDate ? new Date(body.activityDate) : undefined,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        sourceDescription: body.sourceDescription,
        facilityId: body.facilityId,
        businessUnitId: body.businessUnitId,
        supplierName: body.supplierName,
        country: body.country,
        region: body.region,
        spendAmount: body.spendAmount,
        spendCurrency: body.spendCurrency,
        distanceAmount: body.distanceAmount,
        distanceUnit: body.distanceUnit,
        transportMode: body.transportMode,
        fuelType: body.fuelType,
        refrigerantType: body.refrigerantType,
        scope2Method: body.scope2Method,
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
      metadata: { unit: record.unit, emissionCategoryId: record.emissionCategoryId },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
