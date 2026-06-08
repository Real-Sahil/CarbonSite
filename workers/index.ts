import { createHash } from "crypto";
import { pathToFileURL } from "url";
import { PgBoss } from "pg-boss";
import type { Job } from "pg-boss";
import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeCo2e } from "@/lib/calculation/engine";
import { selectFactor } from "@/lib/calculation/factor-selector";
import { getObjectBuffer, keys, putObject } from "@/lib/storage";
import type {
  ImportJobData,
  CalculationJobData,
  ReportJobData,
  NotificationJobData,
} from "@/lib/jobs/queues/index";

const boss = new PgBoss({
  connectionString: process.env.DATABASE_URL!,
  max: 10,
});

boss.on("error", (err: Error) => console.error("[pg-boss]", err));

async function start() {
  await boss.start();

  await boss.work<ImportJobData>(
    "imports",
    { localConcurrency: 2 },
    async (jobs: Job<ImportJobData>[]) => {
      for (const job of jobs) {
        await processImport(job.data);
      }
    },
  );

  await boss.work<CalculationJobData>(
    "calculations",
    { localConcurrency: 2 },
    async (jobs: Job<CalculationJobData>[]) => {
      for (const job of jobs) {
        await processCalculation(job.data);
      }
    },
  );

  await boss.work<ReportJobData>(
    "reports",
    { localConcurrency: 1 },
    async (jobs: Job<ReportJobData>[]) => {
      for (const job of jobs) {
        await processReport(job.data);
      }
    },
  );

  await boss.work<NotificationJobData>(
    "notifications",
    { localConcurrency: 5 },
    async (jobs: Job<NotificationJobData>[]) => {
      for (const job of jobs) {
        await processNotification(job.data);
      }
    },
  );

  console.log("pg-boss workers started");
}

export async function processImport(data: ImportJobData) {
  const batch = await prisma.importBatch.findFirst({
    where: { id: data.importBatchId, organizationId: data.orgId },
  });
  if (!batch) return;

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { state: "parsing" },
  });

  try {
    const buffer = await getObjectBuffer(batch.sourceStorageKey);
    const rows = parseImportRows(buffer, batch.sourceFilename);
    const stagedRows = rows.map((row, index) => {
      const validationErrors = validateImportRow(row);
      return {
        organizationId: data.orgId,
        importBatchId: batch.id,
        rowNumber: index + 1,
        data: row,
        validationErrors,
        validationWarnings: [],
        status: validationErrors.length === 0 ? "ready" : "staged",
      } as const;
    });
    const errorCount = stagedRows.filter((row) => row.validationErrors.length > 0).length;

    await prisma.$transaction([
      prisma.stagedActivityRecord.deleteMany({
        where: { importBatchId: batch.id },
      }),
      ...(stagedRows.length
        ? [
            prisma.stagedActivityRecord.createMany({
              data: stagedRows,
            }),
          ]
        : []),
      prisma.importBatch.update({
        where: { id: batch.id },
        data: {
          state: errorCount > 0 ? "needs_attention" : "ready_to_commit",
          rowCount: stagedRows.length,
          errorCount,
          warningCount: 0,
        },
      }),
    ]);
  } catch (err) {
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        state: "failed",
        errorCount: 1,
      },
    });
    console.error("[imports] failed", data, err);
    throw err;
  }
}

export async function processCalculation(data: CalculationJobData) {
  const run = await prisma.calculationRun.findFirst({
    where: { id: data.calculationRunId, organizationId: data.orgId },
    include: {
      methodologyVersion: true,
      factorLibrary: true,
    },
  });
  if (!run) return;

  await prisma.calculationRun.update({
    where: { id: run.id },
    data: { status: "running", startedAt: new Date() },
  });

  try {
    const records = await prisma.activityRecord.findMany({
      where: {
        organizationId: data.orgId,
        reportingPeriodId: run.reportingPeriodId,
        reviewStatus: "approved",
      },
      include: { emissionCategory: true },
    });

    const calculations: Prisma.EmissionCalculationCreateManyInput[] = [];
    for (const record of records) {
      const factorSelection = await selectFactor({
        emissionCategoryId: record.emissionCategoryId,
        activityType: record.emissionCategory.activityType,
        geographyCountry: record.country,
        activityDate: record.activityDate ?? record.startDate ?? new Date(),
        factorLibraryId: run.factorLibraryId,
      });

      if (!factorSelection) {
        throw new Error(`No emission factor found for record ${record.id}`);
      }

      const result = computeCo2e(
        Number(record.amount),
        record.unit,
        {
          co2: factorSelection.factor.co2 != null ? Number(factorSelection.factor.co2) : null,
          ch4: factorSelection.factor.ch4 != null ? Number(factorSelection.factor.ch4) : null,
          n2o: factorSelection.factor.n2o != null ? Number(factorSelection.factor.n2o) : null,
          co2e: factorSelection.factor.co2e != null ? Number(factorSelection.factor.co2e) : null,
        },
        factorSelection.factor.inputUnit,
        [factorSelection.selectionReason],
      );

      calculations.push({
        organizationId: data.orgId,
        activityRecordId: record.id,
        calculationRunId: run.id,
        emissionFactorId: factorSelection.factor.id,
        factorLibraryId: run.factorLibraryId,
        factorLibraryVersion: run.factorLibrary.version,
        methodologyVersionName: run.methodologyVersion.name,
        originalAmount: record.amount,
        originalUnit: record.unit,
        normalizedAmount: record.amount,
        normalizedUnit: record.unit,
        co2: result.co2,
        ch4: result.ch4,
        n2o: result.n2o,
        totalCo2e: result.totalCo2e,
        formula: result.formula,
        warnings: result.warnings,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.emissionCalculation.deleteMany({
        where: { calculationRunId: run.id },
      });
      if (calculations.length) {
        await tx.emissionCalculation.createMany({ data: calculations });
      }
      await tx.dashboardAggregate.deleteMany({
        where: {
          organizationId: data.orgId,
          reportingPeriodId: run.reportingPeriodId,
          snapshotId: null,
        },
      });

      const grouped = new Map<string, { scope: number; categoryId: string; total: number; count: number }>();
      for (const calculation of calculations) {
        const record = records.find((item) => item.id === calculation.activityRecordId);
        if (!record) continue;
        const key = `${record.emissionCategory.scope}:${record.emissionCategoryId}`;
        const current = grouped.get(key) ?? {
          scope: record.emissionCategory.scope,
          categoryId: record.emissionCategoryId,
          total: 0,
          count: 0,
        };
        current.total += Number(calculation.totalCo2e);
        current.count += 1;
        grouped.set(key, current);
      }

      for (const aggregate of grouped.values()) {
        await tx.dashboardAggregate.create({
          data: {
            organizationId: data.orgId,
            reportingPeriodId: run.reportingPeriodId,
            scope: aggregate.scope,
            emissionCategoryId: aggregate.categoryId,
            totalCo2e: aggregate.total,
            recordCount: aggregate.count,
          },
        });
      }

      await tx.calculationRun.update({
        where: { id: run.id },
        data: { status: "succeeded", finishedAt: new Date() },
      });
    });
  } catch (err) {
    await prisma.calculationRun.update({
      where: { id: run.id },
      data: { status: "failed", finishedAt: new Date() },
    });
    console.error("[calculations] failed", data, err);
    throw err;
  }
}

export async function processReport(data: ReportJobData) {
  const report = await prisma.report.findFirst({
    where: { id: data.reportId, organizationId: data.orgId },
    include: {
      organization: true,
      reportingPeriod: true,
      snapshot: true,
    },
  });
  if (!report) return;

  await prisma.report.update({
    where: { id: report.id },
    data: { status: "generating" },
  });

  try {
    const aggregates = await prisma.dashboardAggregate.findMany({
      where: {
        organizationId: data.orgId,
        reportingPeriodId: report.reportingPeriodId,
        snapshotId: report.snapshotId,
      },
      include: { emissionCategory: true, facility: true, businessUnit: true },
      orderBy: [{ scope: "asc" }, { createdAt: "asc" }],
    });

    const csv = [
      ["scope", "category", "facility", "business_unit", "record_count", "total_kgco2e"].join(","),
      ...aggregates.map((row) =>
        [
          row.scope,
          csvEscape(row.emissionCategory?.name ?? ""),
          csvEscape(row.facility?.name ?? ""),
          csvEscape(row.businessUnit?.name ?? ""),
          row.recordCount,
          row.totalCo2e.toString(),
        ].join(","),
      ),
    ].join("\n");

    const pdf = createMinimalPdf([
      "CarbonSite emissions report",
      report.organization.name,
      report.reportingPeriod.label,
      `Report type: ${report.type}`,
      `Snapshot version: ${report.snapshot.version}`,
      `Generated at: ${new Date().toISOString()}`,
    ]);

    const csvBuffer = Buffer.from(csv, "utf8");
    const pdfBuffer = Buffer.from(pdf, "utf8");
    const csvStorageKey = keys.reportCsv(data.orgId, report.id);
    const pdfStorageKey = keys.reportPdf(data.orgId, report.id);

    await Promise.all([
      putObject(csvStorageKey, csvBuffer, "text/csv"),
      putObject(pdfStorageKey, pdfBuffer, "application/pdf"),
    ]);

    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: "ready",
        csvStorageKey,
        pdfStorageKey,
        csvChecksum: createHash("sha256").update(csvBuffer).digest("hex"),
        pdfChecksum: createHash("sha256").update(pdfBuffer).digest("hex"),
        publishedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: data.orgId,
        action: "report.published",
        resourceType: "report",
        resourceId: report.id,
        metadata: {
          snapshotId: report.snapshotId,
          aggregateCount: aggregates.length,
          csvChecksum: createHash("sha256").update(csvBuffer).digest("hex"),
          pdfChecksum: createHash("sha256").update(pdfBuffer).digest("hex"),
        },
      },
    });
  } catch (err) {
    await prisma.report.update({
      where: { id: report.id },
      data: { status: "failed" },
    });
    console.error("[reports] failed", data, err);
    throw err;
  }
}

async function processNotification(data: NotificationJobData) {
  await prisma.auditLog.create({
    data: {
      organizationId: data.orgId,
      action: `notification.${data.type}`,
      resourceType: "notification",
      resourceId: data.resourceId,
      metadata: {
        recipientUserId: data.recipientUserId,
        ...data.metadata,
      },
    },
  });
}

function parseImportRows(buffer: Buffer, filename: string): Record<string, string>[] {
  if (filename.toLowerCase().endsWith(".xlsx")) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) return [];
    return XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[firstSheet], {
      defval: "",
      raw: false,
    });
  }

  return parseCsv(buffer.toString("utf8"));
}

function parseCsv(input: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [headers = [], ...body] = rows.filter((item) => item.some((cell) => cell.trim()));
  return body.map((cells) =>
    Object.fromEntries(
      headers.map((header, index) => [header.trim(), cells[index]?.trim() ?? ""]),
    ),
  );
}

function validateImportRow(row: Record<string, string>) {
  const errors: string[] = [];
  if (!row.amount || Number.isNaN(Number(row.amount))) errors.push("amount must be numeric");
  if (!row.unit) errors.push("unit is required");
  if (!row.emissionCategoryId && !row.emission_category_id) {
    errors.push("emissionCategoryId is required");
  }
  return errors;
}

function csvEscape(value: string) {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

function createMinimalPdf(lines: string[]) {
  const text = lines
    .map((line, index) => `BT /F1 12 Tf 72 ${760 - index * 18} Td (${pdfEscape(line)}) Tj ET`)
    .join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(text)} >> stream\n${text}\nendstream endobj`,
  ];
  const header = "%PDF-1.4\n";
  let offset = Buffer.byteLength(header);
  const xref = ["0000000000 65535 f "];
  const body = objects
    .map((object) => {
      xref.push(`${String(offset).padStart(10, "0")} 00000 n `);
      offset += Buffer.byteLength(`${object}\n`);
      return object;
    })
    .join("\n");
  const xrefOffset = Buffer.byteLength(`${header}${body}\n`);
  return `${header}${body}\nxref\n0 ${xref.length}\n${xref.join("\n")}\ntrailer << /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
}

function pdfEscape(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch((err) => {
    console.error("Worker failed to start:", err);
    process.exit(1);
  });
}
