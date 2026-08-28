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

// Webhook ingest request schema
const WebhookRecordSchema = z.object({
  emissionCategoryCode: z.string().min(1),
  amount: z.number().positive(),
  unit: z.string().min(1),
  activityDate: z.string().datetime().optional(),
  sourceDescription: z.string().optional(),
  facilityName: z.string().optional(),
  businessUnitName: z.string().optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  supplierName: z.string().optional(),
  fuelType: z.string().optional(),
  transportMode: z.string().optional(),
  spendAmount: z.number().optional(),
  spendCurrency: z.string().optional(),
  distanceAmount: z.number().optional(),
  distanceUnit: z.string().optional(),
});

const WebhookIngestSchema = z.object({
  reportingPeriodId: z.string().min(1),
  records: z.array(WebhookRecordSchema).min(1).max(1000),
  metadata: z
    .object({
      source: z.string().optional(),
      batchId: z.string().optional(),
    })
    .optional(),
});

type WebhookRecord = z.infer<typeof WebhookRecordSchema>;

/**
 * Convert webhook JSON records to CSV format for standard import pipeline.
 */
function recordsToCSV(records: WebhookRecord[]): string {
  const headers = [
    "emissionCategoryCode",
    "amount",
    "unit",
    "activityDate",
    "sourceDescription",
    "facilityName",
    "businessUnitName",
    "country",
    "region",
    "supplierName",
    "fuelType",
    "transportMode",
    "spendAmount",
    "spendCurrency",
    "distanceAmount",
    "distanceUnit",
  ];

  const csvLines = [headers.join(",")];

  for (const record of records) {
    const row = [
      escapeCsv(record.emissionCategoryCode),
      record.amount.toString(),
      escapeCsv(record.unit),
      record.activityDate ?? "",
      escapeCsv(record.sourceDescription ?? ""),
      escapeCsv(record.facilityName ?? ""),
      escapeCsv(record.businessUnitName ?? ""),
      escapeCsv(record.country ?? ""),
      escapeCsv(record.region ?? ""),
      escapeCsv(record.supplierName ?? ""),
      escapeCsv(record.fuelType ?? ""),
      escapeCsv(record.transportMode ?? ""),
      record.spendAmount?.toString() ?? "",
      escapeCsv(record.spendCurrency ?? ""),
      record.distanceAmount?.toString() ?? "",
      escapeCsv(record.distanceUnit ?? ""),
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
 * POST /api/orgs/[orgId]/integrations/webhooks/ingest
 * Accept structured activity data via API key authentication.
 * Creates an ImportBatch and dispatches to standard validation pipeline.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;

    // TODO: Implement webhook data ingest after auth strategy updates (Phase 2+)
    return apiError("NOT_IMPLEMENTED", "Webhook data ingest feature coming in Phase 2. Integration not yet available.", 501);

    /* DISABLED: Incomplete webhook integration
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

    const parsed = WebhookIngestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid request schema",
        400,
        parsed.error.flatten(),
      );
    }

    const { reportingPeriodId, records, metadata } = parsed.data;

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

    // Convert webhook JSON records to CSV format for standard import pipeline
    const csvData = recordsToCSV(records);
    const buffer = Buffer.from(csvData);
    const checksum = createHash("sha256").update(buffer).digest("hex");

    // Create import batch with webhook template
    const batch = await prisma.importBatch.create({
      data: {
        organizationId: orgId,
        reportingPeriodId,
        templateKey: "webhook",
        sourceFilename: `webhook-${Date.now()}.csv`,
        sourceStorageKey: "pending",
        sourceChecksum: checksum,
        state: "uploaded",
        createdByUserId: "", // System-generated from webhook, no user context
        // Store webhook metadata for tracking
        mapping: {
          source: metadata?.source ?? "webhook",
          batchId: metadata?.batchId ?? null,
          recordCount: records.length,
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
      console.error(`[webhook] batch ${batch.id} failed:`, err),
    );

    // Audit log
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: undefined, // Webhook system action, not user-initiated
      action: "import.created",
      resourceType: "import_batch",
      resourceId: batch.id,
      metadata: {
        recordCount: records.length,
        source: metadata?.source ?? "webhook",
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
        recordCount: records.length,
        message: `Webhook ingested ${records.length} records. Processing status: ${finalBatch?.state}.`,
      },
      { status: 202 },
    );
    */
  } catch (err) {
    return handleRouteError(err);
  }
}
