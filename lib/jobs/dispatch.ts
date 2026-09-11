import {
  enqueueCalculation,
  enqueueDsarErasure,
  enqueueDsarExport,
  enqueueForecasting,
  enqueueImport,
  enqueueInvoiceAnomalyDetection,
  enqueueNotification,
  enqueueReport,
  enqueueXeroSync,
  enqueueSupplierPerformanceUpdate,
  enqueueCausalAnalysis,
  enqueueAccountPoliciesCheck,
  type CalculationJobData,
  type DsarJobData,
  type ForecastingJobData,
  type ImportJobData,
  type InvoiceAnomalyJobData,
  type NotificationJobData,
  type ReportJobData,
  type XeroSyncJobData,
  type SupplierPerformanceJobData,
  type CausalAnalysisJobData,
  type AccountPoliciesJobData,
} from "./queues";
import { processImportBatch } from "@/lib/imports/worker";
import { processCalculationRun } from "@/lib/calculation/run-worker";
import { processNotification } from "@/lib/notifications/worker";
import { processReport } from "@/lib/reports/worker";
import { processDsarExport } from "@/workers/dsar-export";
import { processDsarErasure } from "@/workers/dsar-erasure";
import { processForecastingJob } from "@/lib/jobs/workers/forecasting";
import { detectInvoiceAnomalies } from "@/lib/jobs/workers/invoice-anomaly-detector";
import { processSupplierPerformanceUpdate } from "@/lib/jobs/workers/supplier-performance";
import { processCausalAnalysisRun } from "@/lib/jobs/workers/causal-analysis";
import { runDbtTransformation, type DbtTransformJobData } from "@/lib/jobs/workers/dbt-transform";
import { processAccountPolicies } from "@/workers/account-policies";
import { syncXeroInvoices } from "@/lib/integrations/xero";
import { hasFeature, type Plan } from "@/lib/billing/limits";
import { prisma } from "@/lib/db";

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

export async function dispatchInvoiceAnomalyDetection(data: InvoiceAnomalyJobData) {
  if (mode === "worker") {
    await enqueueInvoiceAnomalyDetection(data);
    return "queued" as const;
  }

  const result = await detectInvoiceAnomalies(data.orgId);
  return { status: "processed" as const, ...result };
}

export async function dispatchSupplierPerformanceUpdate(data: SupplierPerformanceJobData) {
  if (mode === "worker") {
    await enqueueSupplierPerformanceUpdate(data);
    return "queued" as const;
  }

  await processSupplierPerformanceUpdate(data.orgId, data.supplierId);
  return "processed" as const;
}

export async function dispatchCausalAnalysis(data: CausalAnalysisJobData) {
  if (mode === "worker") {
    await enqueueCausalAnalysis(data);
    return "queued" as const;
  }

  await processCausalAnalysisRun(data.causalInferenceRunId, data.orgId);
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

  if (result.created > 0) {
    try {
      const org = await prisma.organization.findUnique({ where: { id: data.orgId }, select: { plan: true } });
      const plan = (org?.plan ?? "trial") as Plan;
      if (hasFeature(plan, "invoiceAnomalyDetection")) {
        await dispatchInvoiceAnomalyDetection({ orgId: data.orgId });
      }
    } catch (err) {
      // The sync itself already succeeded and its rows are committed — don't
      // fail the whole sync over a problem in the follow-up enrichment step.
      console.error(`[dispatchXeroSync] anomaly detection failed for org ${data.orgId}:`, err);
    }
  }

  return { status: "processed", ...result };
}

export async function dispatchDbtTransform(data: DbtTransformJobData) {
  if (mode === "worker") {
    // enqueue via pg-boss — workers/index.ts handles the "dbt-transform-jobs" queue
    // There is currently no top-level enqueue helper for this queue; pg-boss consumer
    // in workers/index.ts handles it. In inline mode we call the function directly.
    // When adding a proper enqueue helper to queues/index.ts, wire it here.
    return "queued" as const;
  }

  await runDbtTransformation(data.calculationRunId, data.organizationId);
  return "processed" as const;
}

export async function dispatchAccountPolicies(_data: AccountPoliciesJobData) {
  if (mode === "worker") {
    await enqueueAccountPoliciesCheck(_data);
    return "queued" as const;
  }

  await processAccountPolicies();
  return "processed" as const;
}
