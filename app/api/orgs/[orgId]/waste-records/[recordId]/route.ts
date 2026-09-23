export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { updateWasteRecordSchema } from "@/lib/validation/environmental";
import { syncWasteRecordCalculation, rebuildEnvironmentalMetricAggregates } from "@/lib/calculation/environmental-metrics";

type Params = { params: Promise<{ orgId: string; recordId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const record = await prisma.wasteRecord.findFirst({
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

    const existing = await prisma.wasteRecord.findFirst({ where: { id: recordId, organizationId: orgId } });
    if (!existing) return apiError("NOT_FOUND", "Record not found.", 404);

    const parsed = updateWasteRecordSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid waste record.", 400, parsed.error.flatten());
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

    const record = await prisma.wasteRecord.update({
      where: { id: recordId },
      data: {
        facilityId: body.facilityId,
        projectId: body.projectId,
        reportingPeriodId: body.reportingPeriodId,
        wasteType: body.wasteType,
        disposalRoute: body.disposalRoute,
        hazardous: body.hazardous,
        weightTonnes: body.weightTonnes,
        ewcCode: body.ewcCode,
        carrierName: body.carrierName,
        carrierRegistration: body.carrierRegistration,
        transferNoteReference: body.transferNoteReference,
        destination: body.destination,
        vehicleRegistration: body.vehicleRegistration,
        recordedAt: body.recordedAt ? new Date(body.recordedAt) : undefined,
        notes: body.notes,
      },
    });

    const calc = await syncWasteRecordCalculation(recordId, session.user.id);
    await rebuildEnvironmentalMetricAggregates(orgId, record.reportingPeriodId ?? existing.reportingPeriodId!);
    if (existing.reportingPeriodId && existing.reportingPeriodId !== record.reportingPeriodId) {
      await rebuildEnvironmentalMetricAggregates(orgId, existing.reportingPeriodId);
    }

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.updated",
      resourceType: "waste_record",
      resourceId: recordId,
      metadata: { changes: body, co2eTonnes: calc?.co2eTonnes ?? null },
    });

    return NextResponse.json({ ...record, co2eTonnes: calc?.co2eTonnes ?? record.co2eTonnes });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const record = await prisma.wasteRecord.findUnique({
      where: { id: recordId },
      select: { id: true, organizationId: true, activityRecordId: true, reportingPeriodId: true },
    });
    if (!record) return apiError("NOT_FOUND", "Record not found", 404);
    if (record.organizationId !== orgId) return apiError("FORBIDDEN", "Access denied", 403);

    // Deleting the WasteRecord cascades to nothing on ActivityRecord (the FK
    // is SET NULL) — the linked ActivityRecord and its immutable
    // EmissionCalculation history stay, matching "never delete calculation
    // history" elsewhere in this codebase. Clear the link explicitly so a
    // stale activityRecordId can't reappear if this row's id is ever reused.
    await prisma.wasteRecord.delete({ where: { id: recordId } });

    if (record.reportingPeriodId) {
      await rebuildEnvironmentalMetricAggregates(orgId, record.reportingPeriodId);
    }

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.deleted",
      resourceType: "waste_record",
      resourceId: recordId,
      metadata: {},
    });

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
