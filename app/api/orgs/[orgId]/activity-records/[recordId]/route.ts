export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { updateActivityRecordSchema } from "@/lib/validation/records";

type Params = { params: Promise<{ orgId: string; recordId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const record = await prisma.activityRecord.findUnique({
      where: { id: recordId },
      include: {
        reportingPeriod: { select: { label: true } },
        emissionCategory: { select: { scope: true, name: true, code: true } },
        facility: { select: { name: true } },
        businessUnit: { select: { name: true } },
        evidence: { include: { evidenceFile: { select: { id: true, filename: true, mimeType: true } } } },
        calculations: {
          include: {
            methodologyVersion: { select: { name: true, gwpVersion: true } },
            calculationRun: { include: { factorLibrary: { select: { name: true, version: true } } } },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        importBatch: { select: { id: true, sourceFilename: true, state: true } },
        _count: { select: { calculations: true } },
      },
    });

    if (!record || record.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Activity record not found.", 404);
    }

    return NextResponse.json(record);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const existing = await prisma.activityRecord.findUnique({
      where: { id: recordId },
      select: { organizationId: true, reportingPeriodId: true },
    });
    if (!existing || existing.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Activity record not found.", 404);
    }

    const body = updateActivityRecordSchema.parse(await req.json());

    const record = await prisma.activityRecord.update({
      where: { id: recordId },
      data: {
        ...(body.amount !== undefined ? { amount: body.amount } : {}),
        ...(body.unit !== undefined ? { unit: body.unit } : {}),
        ...(body.activityDate !== undefined ? { activityDate: body.activityDate ? new Date(body.activityDate) : null } : {}),
        ...(body.sourceDescription !== undefined ? { sourceDescription: body.sourceDescription } : {}),
        ...(body.facilityId !== undefined ? { facilityId: body.facilityId } : {}),
        ...(body.businessUnitId !== undefined ? { businessUnitId: body.businessUnitId } : {}),
        ...(body.supplierName !== undefined ? { supplierName: body.supplierName } : {}),
        ...(body.country !== undefined ? { country: body.country } : {}),
        ...(body.assumptionNotes !== undefined ? { assumptionNotes: body.assumptionNotes } : {}),
        ...(body.dataOrigin !== undefined ? { dataOrigin: body.dataOrigin } : {}),
        ...(body.dataOriginNote !== undefined ? { dataOriginNote: body.dataOriginNote ?? null } : {}),
        ...(body.scope2Method !== undefined ? { scope2Method: body.scope2Method } : {}),
        ...(body.transportMode !== undefined ? { transportMode: body.transportMode } : {}),
        ...(body.fuelType !== undefined ? { fuelType: body.fuelType } : {}),
        ...(body.refrigerantType !== undefined ? { refrigerantType: body.refrigerantType } : {}),
        ...(body.spendAmount !== undefined ? { spendAmount: body.spendAmount } : {}),
        ...(body.spendCurrency !== undefined ? { spendCurrency: body.spendCurrency } : {}),
        ...(body.distanceAmount !== undefined ? { distanceAmount: body.distanceAmount } : {}),
        ...(body.distanceUnit !== undefined ? { distanceUnit: body.distanceUnit } : {}),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.updated",
      resourceType: "activity_record",
      resourceId: recordId,
    });

    return NextResponse.json(record);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const record = await prisma.activityRecord.findUnique({
      where: { id: recordId },
      select: { organizationId: true, _count: { select: { calculations: true } } },
    });
    if (!record || record.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Activity record not found.", 404);
    }
    if (record._count.calculations > 0) {
      return apiError("CONFLICT", "Cannot delete a record with existing calculations.", 409);
    }

    await prisma.activityRecord.delete({ where: { id: recordId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.deleted",
      resourceType: "activity_record",
      resourceId: recordId,
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
