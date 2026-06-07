import {
  enqueueCalculation,
  enqueueImport,
  enqueueReport,
  type CalculationJobData,
  type ImportJobData,
  type ReportJobData,
} from "./queues";
import {
  processCalculation,
  processImport,
  processReport,
} from "@/workers/index";

const mode = process.env.JOB_PROCESSING_MODE ?? "inline";

export async function dispatchImport(data: ImportJobData) {
  if (mode === "worker") {
    await enqueueImport(data);
    return "queued" as const;
  }

  await processImport(data);
  return "processed" as const;
}

export async function dispatchCalculation(data: CalculationJobData) {
  if (mode === "worker") {
    await enqueueCalculation(data);
    return "queued" as const;
  }

  await processCalculation(data);
  return "processed" as const;
}

export async function dispatchReport(data: ReportJobData) {
  if (mode === "worker") {
    await enqueueReport(data);
    return "queued" as const;
  }

  await processReport(data);
  return "processed" as const;
}
