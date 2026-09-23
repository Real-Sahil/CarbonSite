export const dynamic = "force-dynamic";

// ESRS E5 waste tracking. Unlike water, waste already has a real GHG angle
// (Scope 3 Category 5, EmissionCategory "s3-waste"): every save creates or
// updates a linked ActivityRecord and runs it through the real
// factor-selection/CO2e engine (see lib/calculation/environmental-metrics.ts)
// instead of a hardcoded factor table, so the CO2e actually reaches the
// dashboard and published reports.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { createWasteRecordSchema } from "@/lib/validation/environmental";
import { syncWasteRecordCalculation, rebuildEnvironmentalMetricAggregates } from "@/lib/calculation/environmental-metrics";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const { searchParams } = new URL(req.url);
    const facilityId = searchParams.get("facilityId");
    const projectId = searchParams.get("projectId");
    const reportingPeriodId = searchParams.get("reportingPeriodId");
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 100);

    const records = await prisma.wasteRecord.findMany({
      where: {
        organizationId: orgId,
        ...(facilityId ? { facilityId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(reportingPeriodId ? { reportingPeriodId } : {}),
        ...(cursor ? { recordedAt: { lt: new Date(cursor) } } : {}),
      },
      include: { facility: { select: { id: true, name: true } } },
      orderBy: { recordedAt: "desc" },
      take: limit + 1,
    });

    const hasMore = records.length > limit;
    const data = hasMore ? records.slice(0, limit) : records;
    const nextCursor = hasMore ? data[data.length - 1]?.recordedAt.toISOString() : null;

    const totals = await prisma.wasteRecord.aggregate({
      where: {
        organizationId: orgId,
        ...(facilityId ? { facilityId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(reportingPeriodId ? { reportingPeriodId } : {}),
      },
      _sum: { weightTonnes: true, co2eTonnes: true },
    });

    return NextResponse.json({
      data,
      nextCursor,
      totalWeightTonnes: Number(totals._sum.weightTonnes ?? 0),
      totalCo2eTonnes: Number(totals._sum.co2eTonnes ?? 0),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const parsed = createWasteRecordSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid waste record.", 400, parsed.error.flatten());
    }
    const body = parsed.data;

    const [facility, reportingPeriod] = await Promise.all([
      prisma.facility.findFirst({ where: { id: body.facilityId, organizationId: orgId } }),
      prisma.reportingPeriod.findFirst({ where: { id: body.reportingPeriodId, organizationId: orgId } }),
    ]);
    if (!facility) return apiError("NOT_FOUND", "Facility not found.", 404);
    if (!reportingPeriod) return apiError("NOT_FOUND", "Reporting period not found.", 404);
    if (body.projectId) {
      const project = await prisma.project.findFirst({ where: { id: body.projectId, organizationId: orgId } });
      if (!project) return apiError("NOT_FOUND", "Project not found.", 404);
    }

    const record = await prisma.wasteRecord.create({
      data: {
        organizationId: orgId,
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
        dataSource: "manual",
        recordedAt: new Date(body.recordedAt),
        notes: body.notes,
        createdByUserId: session.user.id,
      },
    });

    const calc = await syncWasteRecordCalculation(record.id, session.user.id);
    await rebuildEnvironmentalMetricAggregates(orgId, body.reportingPeriodId);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.created",
      resourceType: "waste_record",
      resourceId: record.id,
      metadata: { disposalRoute: body.disposalRoute, weightTonnes: body.weightTonnes, co2eTonnes: calc?.co2eTonnes ?? null },
    });

    return NextResponse.json({ ...record, co2eTonnes: calc?.co2eTonnes ?? null }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
