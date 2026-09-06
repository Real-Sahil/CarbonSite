export const dynamic = "force-dynamic";

// Direct parse-validate-commit CSV upload for water records. Unlike the GHG
// ActivityRecord import pipeline, there is no factor-selection ambiguity to
// review here, so this deliberately skips the ImportBatch/StagedActivityRecord
// staging state machine — rows are validated and committed in one pass, with
// per-row errors returned for anything that failed.

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { waterRecordCsvRowSchema } from "@/lib/validation/environmental";
import { parseSpreadsheet } from "@/lib/imports/parser";
import { rebuildEnvironmentalMetricAggregates } from "@/lib/calculation/environmental-metrics";

type Params = { params: Promise<{ orgId: string }> };

const WATER_STRESSED_LEVELS = new Set(["medium_high", "high", "extremely_high"]);

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const formData = await req.formData().catch(() => null);
    const file = formData?.get("file");
    if (!file || !(file instanceof File)) {
      return apiError("VALIDATION_ERROR", "No file uploaded.", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows } = await parseSpreadsheet(buffer, file.name);
    if (rows.length === 0) {
      return apiError("VALIDATION_ERROR", "File contains no data rows.", 400);
    }
    if (rows.length > 5000) {
      return apiError("VALIDATION_ERROR", "Bulk upload is limited to 5,000 rows per file.", 400);
    }

    const facilities = await prisma.facility.findMany({ where: { organizationId: orgId }, select: { id: true, waterStressLevel: true } });
    const facilityById = new Map(facilities.map((f) => [f.id, f]));
    const periods = await prisma.reportingPeriod.findMany({ where: { organizationId: orgId }, select: { id: true } });
    const periodIds = new Set(periods.map((p) => p.id));

    const errors: { row: number; message: string }[] = [];
    const toCreate: Prisma.WaterRecordCreateManyInput[] = [];
    const touchedPeriods = new Set<string>();

    rows.forEach((row, i) => {
      const parsed = waterRecordCsvRowSchema.safeParse(row);
      if (!parsed.success) {
        errors.push({ row: i + 2, message: parsed.error.issues.map((iss) => iss.message).join("; ") });
        return;
      }
      const data = parsed.data;
      const facility = facilityById.get(data.facilityId);
      if (!facility) {
        errors.push({ row: i + 2, message: `Facility "${data.facilityId}" not found in this organisation.` });
        return;
      }
      if (!periodIds.has(data.reportingPeriodId)) {
        errors.push({ row: i + 2, message: `Reporting period "${data.reportingPeriodId}" not found in this organisation.` });
        return;
      }
      touchedPeriods.add(data.reportingPeriodId);
      toCreate.push({
        organizationId: orgId,
        facilityId: data.facilityId,
        reportingPeriodId: data.reportingPeriodId,
        metricType: data.metricType,
        source: data.source,
        volumeM3: data.volumeM3,
        isWaterStressedArea: facility.waterStressLevel ? WATER_STRESSED_LEVELS.has(facility.waterStressLevel) : false,
        dataSource: "import",
        recordedAt: data.recordedAt,
        notes: data.notes,
        createdByUserId: session.user.id,
      });
    });

    if (toCreate.length > 0) {
      await prisma.waterRecord.createMany({ data: toCreate });
      for (const periodId of touchedPeriods) {
        await rebuildEnvironmentalMetricAggregates(orgId, periodId);
      }
    }

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.bulk_imported",
      resourceType: "water_record",
      resourceId: "bulk",
      metadata: { fileName: file.name, created: toCreate.length, failed: errors.length },
    });

    return NextResponse.json({ created: toCreate.length, failed: errors.length, errors });
  } catch (err) {
    return handleRouteError(err);
  }
}
