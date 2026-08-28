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

// Fleet telematics data schema - covers vehicle and fuel consumption
const FleetTelematicsSchema = z.object({
  vehicleId: z.string().min(1).describe("Vehicle ID or registration plate"),
  fuelType: z
    .enum(["petrol", "diesel", "lpg", "electric", "hybrid"])
    .describe("Type of fuel consumed"),
  distanceAmount: z.number().positive().describe("Distance traveled"),
  distanceUnit: z.enum(["km", "miles"]).describe("Unit of distance"),
  fuelConsumedAmount: z.number().positive().optional().describe("Fuel consumed (for ICE vehicles)"),
  fuelConsumedUnit: z
    .enum(["liters", "gallons", "kWh"])
    .optional()
    .describe("Fuel consumed unit"),
  energyConsumedAmount: z.number().positive().optional().describe("Energy consumed (for EVs)"),
  energyConsumedUnit: z.enum(["kWh"]).optional().describe("Energy consumed unit"),
  tripDate: z.string().datetime().describe("Date/time of trip"),
  tripPurpose: z
    .enum(["business", "commuting", "delivery"])
    .default("business")
    .describe("Purpose of trip"),
  businessUnitName: z.string().optional().describe("Department or cost center"),
  notes: z.string().optional().describe("Additional trip notes"),
});

const FleetIngestSchema = z.object({
  reportingPeriodId: z.string().min(1),
  trips: z.array(FleetTelematicsSchema).min(1).max(1000),
  metadata: z
    .object({
      source: z.string().optional(),
      batchId: z.string().optional(),
    })
    .optional(),
});

type FleetTelematics = z.infer<typeof FleetTelematicsSchema>;

/**
 * Convert fleet telematics data to CSV format for standard import pipeline.
 * Maps vehicle trips to activity records based on distance and fuel type.
 */
function tripsToCSV(trips: FleetTelematics[]): string {
  const headers = [
    "emissionCategoryCode",
    "amount",
    "unit",
    "activityDate",
    "sourceDescription",
    "businessUnitName",
    "fuelType",
    "transportMode",
  ];

  const csvLines = [headers.join(",")];

  for (const trip of trips) {
    // Map trip purpose to emission category
    const categoryMap: Record<string, string> = {
      business: "s3-business-travel",
      commuting: "s3-commuting",
      delivery: "s3-upstream-transport",
    };

    const category = categoryMap[trip.tripPurpose] || categoryMap.business;

    // Normalize distance to km
    let distanceKm = trip.distanceAmount;
    if (trip.distanceUnit === "miles") {
      distanceKm = trip.distanceAmount * 1.60934; // miles to km
    }

    // For ICE vehicles, prefer fuel consumed if available; otherwise use distance-based estimation
    let emissionAmount = distanceKm;
    let emissionUnit = "km";

    if (
      trip.fuelConsumedAmount &&
      trip.fuelConsumedUnit &&
      (trip.fuelType === "petrol" ||
        trip.fuelType === "diesel" ||
        trip.fuelType === "lpg")
    ) {
      // Use actual fuel consumed
      emissionAmount = trip.fuelConsumedAmount;
      if (trip.fuelConsumedUnit === "gallons") {
        emissionAmount = trip.fuelConsumedAmount * 3.78541; // gallons to liters
      }
      emissionUnit = "liters";
    } else if (trip.fuelType === "electric" && trip.energyConsumedAmount) {
      // Use actual energy consumed for EVs
      emissionAmount = trip.energyConsumedAmount;
      emissionUnit = "kWh";
    }

    const row = [
      escapeCsv(category),
      emissionAmount.toString(),
      emissionUnit,
      trip.tripDate,
      `Fleet telematics: ${trip.vehicleId} (${trip.fuelType}) - ${distanceKm.toFixed(1)} km${trip.notes ? ` - ${trip.notes}` : ""}`,
      escapeCsv(trip.businessUnitName ?? ""),
      escapeCsv(trip.fuelType),
      "car", // transportMode - consistent for vehicle fleet
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
 * POST /api/orgs/[orgId]/integrations/fleet/ingest
 * Accept structured fleet telematics data via API key authentication.
 * Creates an ImportBatch and dispatches to standard validation pipeline.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;

    // TODO: Implement fleet telematics integration after schema updates (Phase 2+)
    return apiError("NOT_IMPLEMENTED", "Fleet telematics ingest feature coming in Phase 2. Integration not yet available.", 501);

    /* DISABLED: Incomplete fleet telematics integration
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

    const parsed = FleetIngestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid request schema",
        400,
        parsed.error.flatten(),
      );
    }

    const { reportingPeriodId, trips, metadata } = parsed.data;

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

    // Convert fleet telematics to CSV format for standard import pipeline
    const csvData = tripsToCSV(trips);
    const buffer = Buffer.from(csvData);
    const checksum = createHash("sha256").update(buffer).digest("hex");

    // Create import batch with fleet template
    const batch = await prisma.importBatch.create({
      data: {
        organizationId: orgId,
        reportingPeriodId,
        templateKey: "fleet",
        sourceFilename: `fleet-${Date.now()}.csv`,
        sourceStorageKey: "pending",
        sourceChecksum: checksum,
        state: "uploaded",
        createdByUserId: null, // System-generated from telematics API, no user context
        // Store fleet metadata for tracking
        mapping: {
          source: metadata?.source ?? "fleet-ingest",
          batchId: metadata?.batchId ?? null,
          recordCount: trips.length,
          fuelTypes: [...new Set(trips.map((t) => t.fuelType))],
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
      console.error(`[fleet] batch ${batch.id} failed:`, err),
    );

    // Audit log
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: undefined, // Fleet system action, not user-initiated
      action: "import.created",
      resourceType: "import_batch",
      resourceId: batch.id,
      metadata: {
        recordCount: trips.length,
        source: metadata?.source ?? "fleet-ingest",
        fuelTypes: [...new Set(trips.map((t) => t.fuelType))],
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
        recordCount: trips.length,
        message: `Fleet ingest received ${trips.length} vehicle trips. Processing status: ${finalBatch?.state}.`,
      },
      { status: 202 },
    );
    */
  } catch (err) {
    return handleRouteError(err);
  }
}
