export const dynamic = "force-dynamic";

// ESRS E3 water tracking. Deliberately outside the ActivityRecord/
// EmissionCalculation pipeline — water withdrawal/discharge/consumption has
// no GHG Protocol scope, so a WaterRecord never drives a CO2e calculation.
// See lib/calculation/environmental-metrics.ts.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { createWaterRecordSchema } from "@/lib/validation/environmental";
import { rebuildEnvironmentalMetricAggregates } from "@/lib/calculation/environmental-metrics";

type Params = { params: Promise<{ orgId: string }> };

const WATER_STRESSED_LEVELS = new Set(["medium_high", "high", "extremely_high"]);

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const { searchParams } = new URL(req.url);
    const facilityId = searchParams.get("facilityId");
    const reportingPeriodId = searchParams.get("reportingPeriodId");
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 100);

    const records = await prisma.waterRecord.findMany({
      where: {
        organizationId: orgId,
        ...(facilityId ? { facilityId } : {}),
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

    const totals = await prisma.waterRecord.groupBy({
      by: ["metricType"],
      where: { organizationId: orgId, ...(facilityId ? { facilityId } : {}), ...(reportingPeriodId ? { reportingPeriodId } : {}) },
      _sum: { volumeM3: true },
    });

    return NextResponse.json({
      data,
      nextCursor,
      totalsByMetricType: Object.fromEntries(totals.map((t) => [t.metricType, Number(t._sum.volumeM3 ?? 0)])),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const parsed = createWaterRecordSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid water record.", 400, parsed.error.flatten());
    }
    const body = parsed.data;

    const [facility, reportingPeriod] = await Promise.all([
      prisma.facility.findFirst({ where: { id: body.facilityId, organizationId: orgId } }),
      prisma.reportingPeriod.findFirst({ where: { id: body.reportingPeriodId, organizationId: orgId } }),
    ]);
    if (!facility) return apiError("NOT_FOUND", "Facility not found.", 404);
    if (!reportingPeriod) return apiError("NOT_FOUND", "Reporting period not found.", 404);

    const record = await prisma.waterRecord.create({
      data: {
        organizationId: orgId,
        facilityId: body.facilityId,
        reportingPeriodId: body.reportingPeriodId,
        metricType: body.metricType,
        source: body.source,
        volumeM3: body.volumeM3,
        isWaterStressedArea: facility.waterStressLevel ? WATER_STRESSED_LEVELS.has(facility.waterStressLevel) : false,
        dataSource: "manual",
        recordedAt: new Date(body.recordedAt),
        notes: body.notes,
        createdByUserId: session.user.id,
      },
    });

    await rebuildEnvironmentalMetricAggregates(orgId, body.reportingPeriodId);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.created",
      resourceType: "water_record",
      resourceId: record.id,
      metadata: { metricType: body.metricType, volumeM3: body.volumeM3, facilityId: body.facilityId },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
