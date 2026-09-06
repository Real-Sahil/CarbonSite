export const dynamic = "force-dynamic";

// Direct parse-validate-commit CSV upload for waste records — see the water
// bulk route for why this skips the ImportBatch staging state machine.
// Each committed row is run through syncWasteRecordCalculation()
// sequentially (not batched) so every row gets its own linked
// ActivityRecord/EmissionCalculation via the real factor-selection engine.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { wasteRecordCsvRowSchema } from "@/lib/validation/environmental";
import { parseSpreadsheet } from "@/lib/imports/parser";
import { syncWasteRecordCalculation, rebuildEnvironmentalMetricAggregates } from "@/lib/calculation/environmental-metrics";

type Params = { params: Promise<{ orgId: string }> };

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
    if (rows.length > 2000) {
      return apiError("VALIDATION_ERROR", "Bulk upload is limited to 2,000 rows per file (each row calculates a real emission factor).", 400);
    }

    const facilityIds = new Set((await prisma.facility.findMany({ where: { organizationId: orgId }, select: { id: true } })).map((f) => f.id));
    const periodIds = new Set((await prisma.reportingPeriod.findMany({ where: { organizationId: orgId }, select: { id: true } })).map((p) => p.id));

    const errors: { row: number; message: string }[] = [];
    const created: string[] = [];
    const touchedPeriods = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const parsed = wasteRecordCsvRowSchema.safeParse(rows[i]);
      if (!parsed.success) {
        errors.push({ row: i + 2, message: parsed.error.issues.map((iss) => iss.message).join("; ") });
        continue;
      }
      const data = parsed.data;
      if (!facilityIds.has(data.facilityId)) {
        errors.push({ row: i + 2, message: `Facility "${data.facilityId}" not found in this organisation.` });
        continue;
      }
      if (!periodIds.has(data.reportingPeriodId)) {
        errors.push({ row: i + 2, message: `Reporting period "${data.reportingPeriodId}" not found in this organisation.` });
        continue;
      }

      const record = await prisma.wasteRecord.create({
        data: {
          organizationId: orgId,
          facilityId: data.facilityId,
          reportingPeriodId: data.reportingPeriodId,
          wasteType: data.wasteType,
          disposalRoute: data.disposalRoute,
          hazardous: data.hazardous,
          weightTonnes: data.weightTonnes,
          ewcCode: data.ewcCode,
          carrierName: data.carrierName,
          dataSource: "import",
          recordedAt: data.recordedAt,
          notes: data.notes,
          createdByUserId: session.user.id,
        },
      });
      await syncWasteRecordCalculation(record.id, session.user.id);
      created.push(record.id);
      touchedPeriods.add(data.reportingPeriodId);
    }

    for (const periodId of touchedPeriods) {
      await rebuildEnvironmentalMetricAggregates(orgId, periodId);
    }

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.bulk_imported",
      resourceType: "waste_record",
      resourceId: "bulk",
      metadata: { fileName: file.name, created: created.length, failed: errors.length },
    });

    return NextResponse.json({ created: created.length, failed: errors.length, errors });
  } catch (err) {
    return handleRouteError(err);
  }
}
