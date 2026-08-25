import {
  enqueueCalculation,
  enqueueDsarErasure,
  enqueueDsarExport,
  enqueueImport,
  enqueueNotification,
  enqueueReport,
  type CalculationJobData,
  type DsarJobData,
  type ImportJobData,
  type NotificationJobData,
  type ReportJobData,
} from "./queues";
import { processImportBatch } from "@/lib/imports/worker";
import { processCalculationRun } from "@/lib/calculation/run-worker";
import { processNotification } from "@/lib/notifications/worker";
import { processReport } from "@/lib/reports/worker";
import { processDsarExport } from "@/workers/dsar-export";
import { processDsarErasure } from "@/workers/dsar-erasure";

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
