export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { updateWaterRecordSchema } from "@/lib/validation/environmental";
import { rebuildEnvironmentalMetricAggregates } from "@/lib/calculation/environmental-metrics";

type Params = { params: Promise<{ orgId: string; recordId: string }> };

const WATER_STRESSED_LEVELS = new Set(["medium_high", "high", "extremely_high"]);

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const record = await prisma.waterRecord.findFirst({
      where: { id: recordId, organizationId: orgId },
      include: { facility: { select: { id: true, name: true } } },
    });
    if (!record) return apiError("NOT_FOUND", "Record not found.", 404);

    return NextResponse.json(record);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const existing = await prisma.waterRecord.findFirst({ where: { id: recordId, organizationId: orgId } });
    if (!existing) return apiError("NOT_FOUND", "Record not found.", 404);

    const parsed = updateWaterRecordSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid water record.", 400, parsed.error.flatten());
    }
    const body = parsed.data;

    if (body.facilityId) {
      const facility = await prisma.facility.findFirst({ where: { id: body.facilityId, organizationId: orgId } });
      if (!facility) return apiError("NOT_FOUND", "Facility not found.", 404);
    }
    if (body.reportingPeriodId) {
      const period = await prisma.reportingPeriod.findFirst({ where: { id: body.reportingPeriodId, organizationId: orgId } });
      if (!period) return apiError("NOT_FOUND", "Reporting period not found.", 404);
    }

    const facilityForStress = await prisma.facility.findUnique({
      where: { id: body.facilityId ?? existing.facilityId },
      select: { waterStressLevel: true },
    });

    const record = await prisma.waterRecord.update({
      where: { id: recordId },
      data: {
        facilityId: body.facilityId,
        reportingPeriodId: body.reportingPeriodId,
        metricType: body.metricType,
        source: body.source,
        volumeM3: body.volumeM3,
        isWaterStressedArea: facilityForStress?.waterStressLevel
          ? WATER_STRESSED_LEVELS.has(facilityForStress.waterStressLevel)
          : false,
        recordedAt: body.recordedAt ? new Date(body.recordedAt) : undefined,
        notes: body.notes,
      },
    });

    await rebuildEnvironmentalMetricAggregates(orgId, record.reportingPeriodId);
    if (existing.reportingPeriodId !== record.reportingPeriodId) {
      await rebuildEnvironmentalMetricAggregates(orgId, existing.reportingPeriodId);
    }

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.updated",
      resourceType: "water_record",
      resourceId: recordId,
      metadata: { changes: body },
    });

    return NextResponse.json(record);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const existing = await prisma.waterRecord.findFirst({ where: { id: recordId, organizationId: orgId } });
    if (!existing) return apiError("NOT_FOUND", "Record not found.", 404);

    await prisma.waterRecord.delete({ where: { id: recordId } });
    await rebuildEnvironmentalMetricAggregates(orgId, existing.reportingPeriodId);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.deleted",
      resourceType: "water_record",
      resourceId: recordId,
      metadata: {},
    });

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
