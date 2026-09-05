import {
  enqueueCalculation,
  enqueueDsarErasure,
  enqueueDsarExport,
  enqueueForecasting,
  enqueueImport,
  enqueueNotification,
  enqueueReport,
  enqueueXeroSync,
  type CalculationJobData,
  type DsarJobData,
  type ForecastingJobData,
  type ImportJobData,
  type NotificationJobData,
  type ReportJobData,
  type XeroSyncJobData,
} from "./queues";
import { processImportBatch } from "@/lib/imports/worker";
import { processCalculationRun } from "@/lib/calculation/run-worker";
import { processNotification } from "@/lib/notifications/worker";
import { processReport } from "@/lib/reports/worker";
import { processDsarExport } from "@/workers/dsar-export";
import { processDsarErasure } from "@/workers/dsar-erasure";
import { processForecastingJob } from "@/lib/jobs/workers/forecasting";
import { syncXeroInvoices } from "@/lib/integrations/xero";

const mode = process.env.JOB_PROCESSING_MODE ?? "inline";

export async function dispatchImport(data: ImportJobData) {
  if (mode === "worker") {
    await enqueueImport(data);
    return "queued" as const;
  }

  await processImportBatch(data.importBatchId, data.orgId);
  return "processed" as const;
}

export async function dispatchCalculation(data: CalculationJobData) {
  if (mode === "worker") {
    await enqueueCalculation(data);
    return "queued" as const;
  }

  await processCalculationRun(data.calculationRunId, data.orgId);
  return "processed" as const;
}

export async function dispatchReport(data: ReportJobData) {
  if (mode === "worker") {
    await enqueueReport(data);
    return "queued" as const;
  }

  await processReport(data.reportId, data.orgId);
  return "processed" as const;
}

export async function dispatchNotification(data: NotificationJobData) {
  if (mode === "worker") {
    await enqueueNotification(data);
    return "queued" as const;
  }

  await processNotification(data);
  return "processed" as const;
}

export async function dispatchDsarExport(data: DsarJobData) {
  if (mode === "worker") {
    await enqueueDsarExport(data);
    return "queued" as const;
  }

  await processDsarExport(data.dsarRequestId);
  return "processed" as const;
}

export async function dispatchDsarErasure(data: DsarJobData) {
  if (mode === "worker") {
    await enqueueDsarErasure(data);
    return "queued" as const;
  }

  await processDsarErasure(data.dsarRequestId);
  return "processed" as const;
}

export async function dispatchForecast(data: ForecastingJobData) {
  if (mode === "worker") {
    await enqueueForecasting(data);
    return "queued" as const;
  }

  await processForecastingJob(data);
  return "processed" as const;
}

export async function dispatchXeroSync(
  data: XeroSyncJobData,
): Promise<{ status: "queued" } | { status: "processed"; created: number; updated: number; skipped: number }> {
  if (mode === "worker") {
    await enqueueXeroSync(data);
    return { status: "queued" };
  }

  const result = await syncXeroInvoices(data.orgId, data.fromDate);
  return { status: "processed", ...result };
}
