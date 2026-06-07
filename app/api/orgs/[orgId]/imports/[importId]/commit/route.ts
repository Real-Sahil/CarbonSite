import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { getOrCreateRouteDistance } from "@/lib/geo/route-distance";
import { apiError, handleRouteError } from "@/lib/validation/api";

type StagedRowData = Record<string, unknown>;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; importId: string }> },
) {
  try {
    const { orgId, importId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const batch = await prisma.importBatch.findFirst({
      where: { id: importId, organizationId: orgId },
    });
    if (!batch) {
      return apiError("NOT_FOUND", "Import batch was not found.", 404);
    }
    if (batch.state !== "ready_to_commit") {
      return apiError(
        "IMPORT_NOT_READY",
        "Only imports with no validation errors can be committed.",
        422,
      );
    }

    const stagedRows = await prisma.stagedActivityRecord.findMany({
      where: {
        organizationId: orgId,
        importBatchId: importId,
        status: "ready",
      },
      orderBy: { rowNumber: "asc" },
    });

    if (stagedRows.length === 0) {
      return apiError("NO_READY_ROWS", "This import has no ready rows to commit.", 422);
    }

    const period = await prisma.reportingPeriod.findFirst({
      where: { id: batch.reportingPeriodId, organizationId: orgId },
      select: { id: true },
    });
    if (!period) {
      return apiError("INVALID_REPORTING_PERIOD", "Import reporting period no longer exists.", 422);
    }

    const records: Prisma.ActivityRecordCreateManyInput[] = [];
    const rowErrors: Array<{ rowNumber: number; error: string }> = [];

    for (const row of stagedRows) {
      const data = row.data as StagedRowData;
      const categoryId = stringValue(data, "emissionCategoryId", "emission_category_id");
      const amount = numberValue(data, "amount");
      const unit = stringValue(data, "unit");

      if (!categoryId || amount == null || !unit) {
        rowErrors.push({
          rowNumber: row.rowNumber,
          error: "Rows must include emissionCategoryId, amount and unit.",
        });
        continue;
      }

      const category = await prisma.emissionCategory.findUnique({
        where: { id: categoryId },
        select: { id: true },
      });
      if (!category) {
        rowErrors.push({
          rowNumber: row.rowNumber,
          error: `Emission category ${categoryId} does not exist.`,
        });
        continue;
      }

      const pickupPostcode = stringValue(data, "pickupPostcode", "pickup_postcode");
      const deliveryPostcode = stringValue(data, "deliveryPostcode", "delivery_postcode");
      const route =
        pickupPostcode && deliveryPostcode
          ? await getOrCreateRouteDistance({
              organizationId: orgId,
              pickupPostcode,
              deliveryPostcode,
            })
          : null;

      records.push({
        organizationId: orgId,
        reportingPeriodId: batch.reportingPeriodId,
        emissionCategoryId: categoryId,
        importBatchId: batch.id,
        createdByUserId: session.user.id,
        activityDate: dateValue(data, "activityDate", "activity_date"),
        amount,
        unit,
        sourceDescription:
          stringValue(data, "sourceDescription", "source_description") ??
          batch.sourceFilename,
        supplierName: stringValue(data, "supplierName", "supplier_name"),
        country: stringValue(data, "country"),
        distanceAmount: route?.distanceKm ?? numberValue(data, "distanceAmount", "distance_amount"),
        distanceUnit: route ? "km" : stringValue(data, "distanceUnit", "distance_unit"),
        pickupPostcode: route?.pickupPostcode ?? pickupPostcode,
        deliveryPostcode: route?.deliveryPostcode ?? deliveryPostcode,
        pickupLat: route?.pickupLat,
        pickupLng: route?.pickupLng,
        deliveryLat: route?.deliveryLat,
        deliveryLng: route?.deliveryLng,
        routeDistanceId: route?.id,
        routeDistanceSource: route?.provider,
        transportMode: stringValue(data, "transportMode", "transport_mode"),
        fuelType: stringValue(data, "fuelType", "fuel_type"),
        reviewStatus: "draft",
        evidenceStatus: "missing",
      });
    }

    if (rowErrors.length > 0) {
      return apiError("COMMIT_VALIDATION_FAILED", "One or more staged rows are invalid.", 422, rowErrors);
    }

    await prisma.$transaction([
      prisma.activityRecord.createMany({ data: records }),
      prisma.importBatch.update({
        where: { id: batch.id },
        data: { state: "committed", rowCount: records.length },
      }),
    ]);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "import.committed",
      resourceType: "import_batch",
      resourceId: batch.id,
      metadata: {
        recordCount: records.length,
        templateKey: batch.templateKey,
      },
    });

    return NextResponse.json({ committedRecords: records.length });
  } catch (err) {
    return handleRouteError(err);
  }
}

function stringValue(data: StagedRowData, ...keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return undefined;
}

function numberValue(data: StagedRowData, ...keys: string[]) {
  const value = stringValue(data, ...keys);
  if (!value) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function dateValue(data: StagedRowData, ...keys: string[]) {
  const value = stringValue(data, ...keys);
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
