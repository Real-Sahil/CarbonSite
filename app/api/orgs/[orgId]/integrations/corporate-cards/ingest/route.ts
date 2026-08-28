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

// Corporate card transaction schema - covers business expenses
const CorporateCardTransactionSchema = z.object({
  transactionId: z.string().min(1).describe("Unique transaction ID"),
  cardholderName: z.string().optional().describe("Name of card holder"),
  merchantName: z.string().min(1).describe("Vendor/merchant name"),
  merchantCategory: z.enum([
    "airlines",
    "hotels",
    "ground_transport",
    "fuel",
    "restaurants",
    "office_supplies",
    "telecommunications",
    "utilities",
    "other",
  ]),
  transactionAmount: z.number().positive().describe("Transaction amount"),
  transactionCurrency: z.string().default("GBP").describe("Currency code"),
  transactionDate: z.string().datetime().describe("Date/time of transaction"),
  businessUnitName: z.string().optional().describe("Department or cost center"),
  notes: z.string().optional().describe("Transaction notes or description"),
});

const CorporateCardsIngestSchema = z.object({
  reportingPeriodId: z.string().min(1),
  transactions: z.array(CorporateCardTransactionSchema).min(1).max(1000),
  metadata: z
    .object({
      source: z.string().optional(),
      batchId: z.string().optional(),
    })
    .optional(),
});

type CorporateCardTransaction = z.infer<typeof CorporateCardTransactionSchema>;

/**
 * Convert corporate card transactions to CSV format for standard import pipeline.
 * Maps merchant categories to emission categories using spend-based approach.
 */
function transactionsToCSV(transactions: CorporateCardTransaction[]): string {
  const headers = [
    "emissionCategoryCode",
    "amount",
    "unit",
    "activityDate",
    "sourceDescription",
    "businessUnitName",
    "supplierName",
    "spendAmount",
    "spendCurrency",
  ];

  const csvLines = [headers.join(",")];

  for (const transaction of transactions) {
    // Map merchant category to emission category (spend-based Scope 3)
    const categoryMap: Record<string, string> = {
      airlines: "s3-business-travel",
      hotels: "s3-business-travel",
      ground_transport: "s3-business-travel",
      fuel: "s1-mobile",
      restaurants: "s3-purchased-goods", // placeholder; food services
      office_supplies: "s3-purchased-goods",
      telecommunications: "s3-purchased-goods",
      utilities: "s2-electricity-lb", // placeholder; utility bills via spend
      other: "s3-purchased-goods", // catchall
    };

    const category = categoryMap[transaction.merchantCategory];

    const row = [
      escapeCsv(category),
      "1", // unit count (spend-based, not quantity)
      "transaction",
      transaction.transactionDate,
      `Corporate card: ${transaction.merchantCategory} - ${transaction.merchantName}${transaction.notes ? ` (${transaction.notes})` : ""}`,
      escapeCsv(transaction.businessUnitName ?? ""),
      escapeCsv(transaction.merchantName),
      transaction.transactionAmount.toString(),
      escapeCsv(transaction.transactionCurrency),
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
 * POST /api/orgs/[orgId]/integrations/corporate-cards/ingest
 * Accept structured corporate card transaction data via API key authentication.
 * Creates an ImportBatch and dispatches to standard validation pipeline.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;

    // TODO: Implement corporate card integration after schema updates (Phase 2+)
    return apiError("NOT_IMPLEMENTED", "Corporate card ingest feature coming in Phase 2. Integration not yet available.", 501);

    /* DISABLED: Incomplete corporate card integration
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

    const parsed = CorporateCardsIngestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid request schema",
        400,
        parsed.error.flatten(),
      );
    }

    const { reportingPeriodId, transactions, metadata } = parsed.data;

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

    // Convert corporate card transactions to CSV format for standard import pipeline
    const csvData = transactionsToCSV(transactions);
    const buffer = Buffer.from(csvData);
    const checksum = createHash("sha256").update(buffer).digest("hex");

    // Create import batch with corporate-cards template
    const batch = await prisma.importBatch.create({
      data: {
        organizationId: orgId,
        reportingPeriodId,
        templateKey: "corporate-cards",
        sourceFilename: `corporate-cards-${Date.now()}.csv`,
        sourceStorageKey: "pending",
        sourceChecksum: checksum,
        state: "uploaded",
        createdByUserId: null, // System-generated from card provider API, no user context
        // Store corporate cards metadata for tracking
        mapping: {
          source: metadata?.source ?? "corporate-cards-ingest",
          batchId: metadata?.batchId ?? null,
          recordCount: transactions.length,
          merchantCategories: [...new Set(transactions.map((t) => t.merchantCategory))],
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
      console.error(`[corporate-cards] batch ${batch.id} failed:`, err),
    );

    // Audit log
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: undefined, // Corporate card system action, not user-initiated
      action: "import.created",
      resourceType: "import_batch",
      resourceId: batch.id,
      metadata: {
        recordCount: transactions.length,
        source: metadata?.source ?? "corporate-cards-ingest",
        merchantCategories: [...new Set(transactions.map((t) => t.merchantCategory))],
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
        recordCount: transactions.length,
        message: `Corporate cards ingest received ${transactions.length} transactions. Processing status: ${finalBatch?.state}.`,
      },
      { status: 202 },
    );
    */
  } catch (err) {
    return handleRouteError(err);
  }
}
