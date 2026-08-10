import { StagedRecordStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getObject, putObject, keys } from "@/lib/storage";
import { parseSpreadsheet } from "./parser";
import { mapColumns, validateRow, buildErrorCsv } from "./validator";
import { enqueueNotification } from "@/lib/jobs/queues/index";

export async function processImportBatch(importBatchId: string, orgId: string): Promise<void> {
  // Mark as parsing
  await prisma.importBatch.update({
    where: { id: importBatchId },
    data: { state: "parsing" },
  });

  try {
    const batch = await prisma.importBatch.findUniqueOrThrow({
      where: { id: importBatchId },
      select: {
        sourceStorageKey: true,
        sourceFilename: true,
        reportingPeriodId: true,
        organizationId: true,
        mapping: true,
      },
    });

    if (batch.organizationId !== orgId) {
      throw new Error("Org mismatch on import batch.");
    }

    // Load reference data for lookups
    const [categories, facilities, businessUnits] = await Promise.all([
      prisma.emissionCategory.findMany({ select: { id: true, code: true } }),
      prisma.facility.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true },
      }),
      prisma.businessUnit.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true },
      }),
    ]);

    const categoryCodeIndex = new Map(categories.map((c) => [c.code.toLowerCase(), c.id]));
    const facilityNameIndex = new Map(facilities.map((f) => [f.name.toLowerCase(), f.id]));
    const businessUnitNameIndex = new Map(businessUnits.map((b) => [b.name.toLowerCase(), b.id]));

    // Download and parse the file
    const buffer = await getObject(batch.sourceStorageKey);
    const { headers, rows } = parseSpreadsheet(buffer, batch.sourceFilename);

    if (rows.length === 0) {
      await prisma.importBatch.update({
        where: { id: importBatchId },
        data: {
          state: "needs_attention",
          rowCount: 0,
          errorCount: 1,
          warningCount: 0,
        },
      });
      await prisma.stagedActivityRecord.create({
        data: {
          organizationId: orgId,
          importBatchId,
          rowNumber: 0,
          data: {},
          validationErrors: [{ field: "file", message: "The file contains no data rows." }],
          validationWarnings: [],
          status: "staged",
        },
      });
      return;
    }

    // Use a confirmed mapping from the preview UI when available; otherwise
    // fall back to auto-detection so legacy imports still work.
    let columnMap: Map<string, string>;
    const storedMapping = batch.mapping;
    if (
      storedMapping &&
      typeof storedMapping === "object" &&
      !Array.isArray(storedMapping)
    ) {
      columnMap = new Map(
        Object.entries(storedMapping as Record<string, string>),
      );
    } else {
      columnMap = mapColumns(headers);
    }

    // Validate all rows
    const validatedRows = rows.map((row) =>
      validateRow(row, columnMap, categoryCodeIndex, facilityNameIndex, businessUnitNameIndex),
    );

    const errorRows: { rowNumber: number; errors: (typeof validatedRows)[0]["errors"]; warnings: (typeof validatedRows)[0]["warnings"] }[] = [];

    // Collect StagedActivityRecord rows for batched insert
    let totalErrors = 0;
    let totalWarnings = 0;
    let readyCount = 0;

    type StagedRow = {
      organizationId: string;
      importBatchId: string;
      rowNumber: number;
      data: object;
      validationErrors: (typeof validatedRows)[0]["errors"];
      validationWarnings: (typeof validatedRows)[0]["warnings"];
      status: StagedRecordStatus;
    };

    const rowsToInsert: StagedRow[] = [];

    for (let i = 0; i < validatedRows.length; i++) {
      const { data, errors, warnings } = validatedRows[i];
      const rowNumber = i + 2; // 1-based, row 1 is headers
      const hasErrors = errors.length > 0;

      if (hasErrors) {
        totalErrors += errors.length;
        errorRows.push({ rowNumber, errors, warnings });
      }
      totalWarnings += warnings.length;
      if (warnings.length > 0 && !hasErrors) {
        errorRows.push({ rowNumber, errors: [], warnings });
      }

      rowsToInsert.push({
        organizationId: orgId,
        importBatchId,
        rowNumber,
        data: data as object,
        validationErrors: errors,
        validationWarnings: warnings,
        status: (hasErrors ? "staged" : "ready") as StagedRecordStatus,
      });

      if (!hasErrors) readyCount++;
    }

    const BATCH = 500;
    for (let i = 0; i < rowsToInsert.length; i += BATCH) {
      await prisma.stagedActivityRecord.createMany({ data: rowsToInsert.slice(i, i + BATCH) });
      await prisma.importBatch.update({
        where: { id: importBatchId },
        data: { lastProcessedRowIndex: i + Math.min(BATCH, rowsToInsert.length - i) },
      });
    }

    // Determine new batch state
    let newState: "ready_to_commit" | "needs_attention" | "failed";
    if (totalErrors === 0) {
      newState = "ready_to_commit";
    } else if (readyCount > 0) {
      newState = "needs_attention";
    } else {
      newState = "failed";
    }

    // Generate and upload error CSV if there are any issues
    let errorCsvStorageKey: string | undefined;
    if (errorRows.length > 0) {
      const errorCsvBuffer = buildErrorCsv(errorRows);
      if (errorCsvBuffer.length > 0) {
        errorCsvStorageKey = keys.importErrors(orgId, importBatchId);
        await putObject(errorCsvStorageKey, errorCsvBuffer, "text/csv");
      }
    }

    const updatedBatch = await prisma.importBatch.update({
      where: { id: importBatchId },
      data: {
        state: newState,
        rowCount: rows.length,
        errorCount: totalErrors,
        warningCount: totalWarnings,
        ...(errorCsvStorageKey ? { errorCsvStorageKey } : {}),
      },
      select: { createdByUserId: true },
    });

    // Notify the uploader if the batch needs attention or failed
    if (newState === "needs_attention" || newState === "failed") {
      enqueueNotification({
        type: "import_failed",
        recipientUserId: updatedBatch.createdByUserId,
        orgId,
        resourceId: importBatchId,
      }).catch((err) => console.error("[imports] Failed to enqueue notification:", err));
    }
  } catch (err) {
    console.error(`[imports] Error processing batch ${importBatchId}:`, err);
    await prisma.importBatch.update({
      where: { id: importBatchId },
      data: { state: "failed" },
    });
    throw err;
  }
}
