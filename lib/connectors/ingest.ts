// Machine-to-machine ingest for utility, fleet and card-provider exports and
// generic webhooks. Connector output is written as a canonical CSV and run
// through the same import pipeline as a manual upload: validation, facility
// matching and the review → commit step all behave identically, and nothing
// reaches ActivityRecord until a person commits the batch.

import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { validateApiKey } from "@/lib/auth/api-key";
import { dispatchImport } from "@/lib/jobs/dispatch";
import { keys, putObject } from "@/lib/storage";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import type { ConnectorActivityRecord, ConnectorPayload } from "./types";

export const MAX_INGEST_ROWS = 1000;

const COLUMNS = [
  "emissionCategoryCode", "amount", "unit", "activityDate", "startDate", "endDate",
  "sourceDescription", "facilityName", "businessUnitName", "supplierName", "country", "region",
  "fuelType", "transportMode", "refrigerantType", "distanceAmount", "distanceUnit",
  "spendAmount", "spendCurrency", "scope2Method", "assumptionNotes",
] as const;

type CsvRecord = ConnectorActivityRecord & { distanceAmount?: number; distanceUnit?: string };

const day = (d?: Date) => (d ? d.toISOString().slice(0, 10) : "");

function cell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Canonical import CSV (headers match CANONICAL_FIELDS, so no mapping step is needed). */
export function recordsToCsv(records: CsvRecord[]): string {
  const lines = [COLUMNS.join(",")];
  for (const r of records) {
    const row: Record<(typeof COLUMNS)[number], unknown> = {
      emissionCategoryCode: r.emissionCategoryCode,
      amount: r.amount,
      unit: r.unit,
      activityDate: day(r.activityDate),
      startDate: day(r.startDate),
      endDate: day(r.endDate),
      sourceDescription: r.sourceDescription,
      facilityName: r.facilityCode,
      businessUnitName: r.businessUnitCode,
      supplierName: r.supplierName,
      country: r.country,
      region: r.region,
      fuelType: r.fuelType,
      transportMode: r.transportMode,
      refrigerantType: r.refrigerantType,
      distanceAmount: r.distanceAmount,
      distanceUnit: r.distanceUnit,
      spendAmount: r.spendAmount,
      spendCurrency: r.spendCurrency,
      scope2Method: r.scope2Method,
      assumptionNotes: r.validationWarnings?.join("; "),
    };
    lines.push(COLUMNS.map((c) => cell(row[c])).join(","));
  }
  return lines.join("\n");
}

export const ingestEnvelope = z.object({
  reportingPeriodId: z.string().min(1),
  externalBatchId: z.string().max(200).optional(),
});

/**
 * Shared POST handler: API-key auth scoped to the org in the URL, rate limit,
 * body validation, then stage whatever `toPayload` produces.
 */
export async function handleConnectorIngest(
  req: NextRequest,
  params: Promise<{ orgId: string }>,
  source: string,
  bodySchema: z.ZodType<{ reportingPeriodId: string; externalBatchId?: string }>,
  toPayload: (body: never) => Promise<ConnectorPayload>,
): Promise<NextResponse> {
  try {
    const { orgId } = await params;

    let keyOrgId: string;
    try {
      keyOrgId = await validateApiKey(req.headers.get("authorization"));
    } catch {
      return apiError("UNAUTHORIZED", "Send a valid API key as 'Authorization: Bearer csk_...'.", 401);
    }
    if (keyOrgId !== orgId) {
      return apiError("FORBIDDEN", "This API key belongs to a different organisation.", 403);
    }

    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, `ingest-${source}`, "api-key"),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const raw = await req.json().catch(() => null);
    if (raw === null) return apiError("BAD_REQUEST", "The request body must be JSON.", 400);
    const body = bodySchema.parse(raw);

    let payload: ConnectorPayload;
    try {
      payload = await toPayload(body as never);
    } catch (err) {
      // Connectors throw when no row is usable; their message lists why.
      return apiError("NO_VALID_ROWS", err instanceof Error ? err.message : "No valid rows.", 422);
    }

    return await stageConnectorRecords({
      orgId,
      reportingPeriodId: body.reportingPeriodId,
      source,
      externalBatchId: body.externalBatchId,
      records: payload.records,
      waterReadings: payload.waterRecords?.length ?? 0,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function stageConnectorRecords(args: {
  orgId: string;
  reportingPeriodId: string;
  source: string;
  externalBatchId?: string;
  records: CsvRecord[];
  waterReadings?: number;
}): Promise<NextResponse> {
  const { orgId, reportingPeriodId, source, records } = args;

  const period = await prisma.reportingPeriod.findFirst({
    where: { id: reportingPeriodId, organizationId: orgId },
    select: { status: true },
  });
  if (!period) return apiError("NOT_FOUND", "Reporting period not found.", 404);
  if (period.status === "locked") return apiError("LOCKED", "That reporting period is locked.", 409);

  if (records.length === 0) {
    return apiError("NO_VALID_ROWS", "Nothing to import: no row produced an activity record.", 422);
  }

  const csv = Buffer.from(recordsToCsv(records));
  const checksum = createHash("sha256").update(reportingPeriodId).update(csv).digest("hex");

  // The same payload sent twice (a retried webhook) returns the first batch.
  const existing = await prisma.importBatch.findFirst({
    where: { organizationId: orgId, sourceChecksum: checksum, state: { not: "failed" } },
    select: { id: true, state: true },
  });
  if (existing) {
    return NextResponse.json(
      { batchId: existing.id, state: existing.state, duplicate: true, message: "This data was already received." },
      { status: 200 },
    );
  }

  const batch = await prisma.importBatch.create({
    data: {
      organizationId: orgId,
      reportingPeriodId,
      templateKey: `connector:${source}`,
      sourceFilename: `${source}-${args.externalBatchId ?? new Date().toISOString()}.csv`,
      sourceStorageKey: "pending",
      sourceChecksum: checksum,
      state: "uploaded",
      createdByUserId: null,
    },
  });

  const storageKey = keys.importSource(orgId, batch.id);
  try {
    await putObject(storageKey, csv, "text/csv");
  } catch (err) {
    await prisma.importBatch.delete({ where: { id: batch.id } }).catch(() => null);
    throw err;
  }
  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { sourceStorageKey: storageKey, state: "parsing" },
  });

  await dispatchImport({ importBatchId: batch.id, orgId }).catch((err) =>
    console.error(`[ingest:${source}] batch ${batch.id} failed:`, err),
  );

  await writeAuditLog({
    organizationId: orgId,
    actorUserId: null,
    action: "import.created",
    resourceType: "import_batch",
    resourceId: batch.id,
    metadata: { source, via: "api_key", records: records.length, externalBatchId: args.externalBatchId ?? null },
  });

  const final = await prisma.importBatch.findUnique({
    where: { id: batch.id },
    select: { id: true, state: true, rowCount: true, errorCount: true, warningCount: true },
  });

  return NextResponse.json(
    {
      batchId: batch.id,
      state: final?.state,
      records: records.length,
      errors: final?.errorCount ?? 0,
      warnings: final?.warningCount ?? 0,
      ...(args.waterReadings
        ? { waterReadingsIgnored: args.waterReadings, note: "Water readings are not activity data; record them under Water." }
        : {}),
      message: "Received. The batch waits in Imports for someone to review and commit it.",
    },
    { status: 202 },
  );
}
