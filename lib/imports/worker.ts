import { StagedRecordStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getObject, putObject, keys } from "@/lib/storage";
import { parseSpreadsheet } from "./parser";
import { mapColumns, validateRow, buildErrorCsv, type ValidatedRow } from "./validator";
import { applyProfile, profileSpecSchema, PROFILED_COLUMN_MAP } from "./profiles";
import { duplicateKey, findExistingDuplicates, type DuplicateKeyInput } from "@/lib/data-quality/duplicates";
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
        profileSnapshot: true,
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
    const { headers, rows } = await parseSpreadsheet(buffer, batch.sourceFilename);

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

    // An ERP export profile turns ledger lines into canonical rows and leaves
    // out lines no rule includes. Otherwise use a confirmed mapping from the
    // preview UI when available, else auto-detection so legacy imports work.
    type Outcome = ValidatedRow & { excluded?: { actionable: boolean } };
    let validatedRows: Outcome[];
    if (batch.profileSnapshot) {
      const spec = profileSpecSchema.parse(batch.profileSnapshot);
      validatedRows = applyProfile(rows, spec).map((p): Outcome =>
        p.kind === "row"
          ? validateRow(p.row, PROFILED_COLUMN_MAP, categoryCodeIndex, facilityNameIndex, businessUnitNameIndex)
          : { data: {}, errors: [], warnings: [{ field: "row", message: p.reason }], excluded: { actionable: p.actionable } },
      );
    } else {
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
      validatedRows = rows.map((row) =>
        validateRow(row, columnMap, categoryCodeIndex, facilityNameIndex, businessUnitNameIndex),
      );
    }

    // Likely duplicates: a row repeated within the file, or a row matching a
    // record the organisation already has. Warnings, not errors: a genuine
    // repeat (two identical deliveries on one day) can still be committed.
    const existingDuplicates = await findExistingDuplicates(
      orgId,
      validatedRows.filter((v) => v.errors.length === 0 && !v.excluded).map((v) => v.data as DuplicateKeyInput),
    );
    const firstRowByKey = new Map<string, number>();
    validatedRows.forEach((v, i) => {
      if (v.errors.length > 0 || v.excluded) return;
      const key = duplicateKey(v.data as DuplicateKeyInput);
      if (!key) return;
      const earlier = firstRowByKey.get(key);
      if (earlier !== undefined) {
        v.warnings.push({ field: "row", message: `Same category, amount, unit, date and facility as row ${earlier} of this file. Remove it if it is the same line twice.` });
      } else {
        firstRowByKey.set(key, i + 2);
      }
      const existingId = existingDuplicates.get(key);
      if (existingId) {
        v.warnings.push({ field: "row", message: `Matches an existing record (${existingId}). Committing it will count this activity twice.` });
      }
    });

    const errorRows: { rowNumber: number; errors: (typeof validatedRows)[0]["errors"]; warnings: (typeof validatedRows)[0]["warnings"] }[] = [];

    // Collect StagedActivityRecord rows for batched insert
    let totalErrors = 0;
    let totalWarnings = 0;
    let readyCount = 0;
    let excludedCount = 0;

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
      const { data, errors, warnings, excluded } = validatedRows[i];
      const rowNumber = i + 2; // 1-based, row 1 is headers
      const hasErrors = errors.length > 0;

      // Left out by the profile. Only lines that need a rule count as
      // warnings; lines a rule ignores (payroll, rent) are just recorded.
      if (excluded) {
        excludedCount++;
        if (excluded.actionable) {
          totalWarnings += warnings.length;
          errorRows.push({ rowNumber, errors: [], warnings });
        }
        rowsToInsert.push({
          organizationId: orgId,
          importBatchId,
          rowNumber,
          data: {},
          validationErrors: [],
          validationWarnings: warnings,
          status: "excluded" as StagedRecordStatus,
        });
        continue;
      }

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

    // A profile that included nothing leaves nothing to commit: say so.
    if (excludedCount > 0 && readyCount === 0 && totalErrors === 0) {
      const message = "No line matched an include rule in the import profile. Add rules for the accounts listed as left out, then import again.";
      totalErrors = 1;
      errorRows.push({ rowNumber: 0, errors: [{ field: "file", message }], warnings: [] });
      rowsToInsert.push({ organizationId: orgId, importBatchId, rowNumber: 0, data: {}, validationErrors: [{ field: "file", message }], validationWarnings: [], status: "staged" as StagedRecordStatus });
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
    if ((newState === "needs_attention" || newState === "failed") && updatedBatch.createdByUserId) {
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
