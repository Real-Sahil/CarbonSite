export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { validateApiKey } from "@/lib/auth/api-key";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { putObject, keys } from "@/lib/storage";
import { dispatchImport } from "@/lib/jobs/dispatch";

// Utility meter reading schema - covers electricity, gas, water
const UtilityMeterReadingSchema = z.object({
  meterType: z.enum(["electricity", "gas", "water"]).describe("Type of utility meter"),
  supplierId: z.string().min(1).describe("Utility supplier name or code"),
  meterId: z.string().min(1).describe("Unique meter ID or serial number"),
  consumptionAmount: z.number().positive().describe("Amount consumed"),
  consumptionUnit: z.enum(["kWh", "m³", "liters", "gallons"]).describe("Unit of consumption"),
  readingDate: z.string().datetime().describe("Date/time of meter reading"),
  meterLocation: z.string().optional().describe("Facility/location name where meter is installed"),
  notes: z.string().optional().describe("Additional meter reading notes"),
});

const UtilityIngestSchema = z.object({
  reportingPeriodId: z.string().min(1),
  readings: z.array(UtilityMeterReadingSchema).min(1).max(1000),
  metadata: z
    .object({
      source: z.string().optional(),
      batchId: z.string().optional(),
    })
    .optional(),
});

type UtilityMeterReading = z.infer<typeof UtilityMeterReadingSchema>;

/**
 * Convert utility meter readings to CSV format for standard import pipeline.
 * Maps utility consumption to activity records with derived emission factors.
 */
function readingsToCSV(readings: UtilityMeterReading[]): string {
  const headers = [
    "emissionCategoryCode",
    "amount",
    "unit",
    "activityDate",
    "sourceDescription",
    "facilityName",
    "supplierName",
  ];

  const csvLines = [headers.join(",")];

  for (const reading of readings) {
    // Map meter type + consumption unit to emission category and normalized unit
    const categoryMap: Record<string, { category: string; unit: string }> = {
      electricity: { category: "s2-electricity-lb", unit: "kWh" },
      gas: { category: "s1-stationary", unit: "kWh" }, // Convert m³ to kWh (1 m³ ≈ 10.1 kWh)
      water: { category: "s3-upstream-transport", unit: "m³" }, // Placeholder; water emissions are ancillary
    };

    const mapped = categoryMap[reading.meterType] || categoryMap.electricity;

    // Normalize consumption unit
    let normalizedAmount = reading.consumptionAmount;
    const normalizedUnit = mapped.unit;

    if (reading.meterType === "gas" && reading.consumptionUnit === "m³") {
      normalizedAmount = reading.consumptionAmount * 10.1; // Convert m³ to kWh
    } else if (reading.meterType === "gas" && reading.consumptionUnit !== "kWh") {
      // Gas should be in m³ or kWh; other units fall through as-is for later validation
    } else if (reading.meterType === "electricity" && reading.consumptionUnit !== "kWh") {
      // Electricity should be in kWh
    } else if (reading.meterType === "water" && reading.consumptionUnit !== "m³") {
      // Water should be in m³; convert liters/gallons
      if (reading.consumptionUnit === "liters") {
        normalizedAmount = reading.consumptionAmount / 1000;
      } else if (reading.consumptionUnit === "gallons") {
        normalizedAmount = reading.consumptionAmount * 0.00378541; // gallons to m³
      }
    }

    const row = [
      mapped.category,
      normalizedAmount.toString(),
      normalizedUnit,
      reading.readingDate,
      `Utility meter reading: ${reading.meterType} (${reading.meterId})${reading.notes ? ` - ${reading.notes}` : ""}`,
      escapeCsv(reading.meterLocation ?? ""),
      escapeCsv(reading.supplierId),
    ];

    csvLines.push(row.join(","));
  }

  return csvLines.join("\n");
}

function escapeCsv(value: string): string {
  if (!value) return "";
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * POST /api/orgs/[orgId]/integrations/utilities/ingest
 * Accept structured utility meter readings via API key authentication.
 * Creates an ImportBatch and dispatches to standard validation pipeline.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;

    // TODO: Implement utility integration after schema updates (Phase 2+)
    return apiError("NOT_IMPLEMENTED", "Utility data ingest feature coming in Phase 2. Integration not yet available.", 501);

    /* DISABLED: Incomplete utility integration
    // Authenticate via API key
    let authenticatedOrgId: string;
    try {
      authenticatedOrgId = await validateApiKey(req.headers.get("authorization"));
    } catch (err) {
      return apiError("UNAUTHORIZED", "Invalid API key", 401);
    }

    // Ensure the key belongs to the requested org
    if (authenticatedOrgId !== orgId) {
      return apiError("FORBIDDEN", "API key does not belong to this organization", 403);
    }

    // Parse and validate request body
    const body = await req.json().catch(() => null);
    if (!body) {
      return apiError("BAD_REQUEST", "Request body must be valid JSON", 400);
    }

    const parsed = UtilityIngestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid request schema",
        400,
        parsed.error.flatten(),
      );
    }

    const { reportingPeriodId, readings, metadata } = parsed.data;

    // Verify reporting period belongs to this org and is not locked
    const period = await prisma.reportingPeriod.findUnique({
      where: { id: reportingPeriodId },
      select: { organizationId: true, status: true },
    });

    if (!period || period.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Reporting period not found", 404);
    }

    if (period.status === "locked") {
      return apiError("LOCKED", "Reporting period is locked", 409);
    }

    // Convert utility readings to CSV format for standard import pipeline
    const csvData = readingsToCSV(readings);
    const buffer = Buffer.from(csvData);
    const checksum = createHash("sha256").update(buffer).digest("hex");

    // Create import batch with utility template
    const batch = await prisma.importBatch.create({
      data: {
        organizationId: orgId,
        reportingPeriodId,
        templateKey: "utility",
        sourceFilename: `utility-${Date.now()}.csv`,
        sourceStorageKey: "pending",
        sourceChecksum: checksum,
        state: "uploaded",
        createdByUserId: null, // System-generated from utility API, no user context
        // Store utility metadata for tracking
        mapping: {
          source: metadata?.source ?? "utility-ingest",
          batchId: metadata?.batchId ?? null,
          recordCount: readings.length,
          meterTypes: [...new Set(readings.map((r) => r.meterType))],
        },
      },
    });

    // Store CSV data in object storage
    const storageKey = keys.importSource(orgId, batch.id);
    try {
      await putObject(storageKey, buffer, "text/csv");
    } catch (storageErr) {
      // Clean up orphan record
      await prisma.importBatch.delete({ where: { id: batch.id } }).catch(() => null);
      throw storageErr;
    }

    // Update batch with storage key and dispatch to import worker
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { sourceStorageKey: storageKey, state: "parsing" },
    });

    await dispatchImport({ importBatchId: batch.id, orgId }).catch((err) =>
      console.error(`[utilities] batch ${batch.id} failed:`, err),
    );

    // Audit log
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: undefined, // Utility system action, not user-initiated
      action: "import.created",
      resourceType: "import_batch",
      resourceId: batch.id,
      metadata: {
        recordCount: readings.length,
        source: metadata?.source ?? "utility-ingest",
        meterTypes: [...new Set(readings.map((r) => r.meterType))],
      },
    }).catch(() => null); // Non-blocking audit failure

    // Re-fetch final state
    const finalBatch = await prisma.importBatch.findUnique({
      where: { id: batch.id },
      select: {
        id: true,
        state: true,
        errorCount: true,
        warningCount: true,
        rowCount: true,
      },
    });

    return NextResponse.json(
      {
        batchId: finalBatch?.id,
        state: finalBatch?.state,
        recordCount: readings.length,
        message: `Utility ingest received ${readings.length} meter readings. Processing status: ${finalBatch?.state}.`,
      },
      { status: 202 },
    );
    */
  } catch (err) {
    return handleRouteError(err);
  }
}
