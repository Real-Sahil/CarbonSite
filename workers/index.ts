// pg-boss worker entry point — run as a separate process: pnpm worker
// Uses the same Postgres instance as the web app. No Redis required.
// This process never handles HTTP requests.

import { PgBoss } from "pg-boss";
import type { Job } from "pg-boss";
import type {
  ImportJobData,
  CalculationJobData,
  ReportJobData,
  NotificationJobData,
  CausalAnalysisJobData,
} from "@/lib/jobs/queues/index";
import { processImportBatch } from "@/lib/imports/worker";
import { processCalculationRun } from "@/lib/calculation/run-worker";
import { processNotification } from "@/lib/notifications/worker";
import { processReport } from "@/lib/reports/worker";
import { runDbtTransformation } from "@/lib/jobs/workers/dbt-transform";
import type { DbtTransformJobData } from "@/lib/jobs/workers/dbt-transform";
import { detectInvoiceAnomalies } from "@/lib/jobs/workers/invoice-anomaly-detector";
import { processSupplierPerformanceUpdate } from "@/lib/jobs/workers/supplier-performance";
import { processForecastingJob } from "@/lib/jobs/workers/forecasting";
import type { ForecastingJobData } from "@/lib/jobs/workers/forecasting";
import { processCausalAnalysisRun } from "@/lib/jobs/workers/causal-analysis";

interface InvoiceAnomalyJobData {
  organizationId: string;
  sourceSystem?: string;
}

interface SupplierPerformanceJobData {
  orgId: string;
  supplierId: string;
}

const boss = new PgBoss({
  connectionString: process.env.DATABASE_URL!,
  max: 10,
});

boss.on("error", (err: Error) => console.error("[pg-boss]", err));

async function start() {
  await boss.start();

  // ── Imports ──────────────────────────────────────────────────────────────
  await boss.work<ImportJobData>(
    "imports",
    { localConcurrency: 2 },
    async (jobs: Job<ImportJobData>[]) => {
      for (const job of jobs) {
        const { importBatchId, orgId } = job.data;
        console.log(`[imports] processing batch ${importBatchId}`);
        await processImportBatch(importBatchId, orgId);
        console.log(`[imports] finished batch ${importBatchId}`);
      }
    },
  );

  // ── Calculations ──────────────────────────────────────────────────────────
  await boss.work<CalculationJobData>(
    "calculations",
    { localConcurrency: 4 },
    async (jobs: Job<CalculationJobData>[]) => {
      for (const job of jobs) {
        const { calculationRunId, orgId } = job.data;
        console.log(`[calculations] processing run ${calculationRunId}`);
        await processCalculationRun(calculationRunId, orgId);
        console.log(`[calculations] finished run ${calculationRunId}`);
      }
    },
  );

  // ── Reports ───────────────────────────────────────────────────────────────
  await boss.work<ReportJobData>(
    "reports",
    { localConcurrency: 1 },
    async (jobs: Job<ReportJobData>[]) => {
      for (const job of jobs) {
        const { reportId, orgId } = job.data;
        console.log(`[reports] processing report ${reportId}`);
        await processReport(reportId, orgId);
        console.log(`[reports] finished report ${reportId}`);
      }
    },
  );

  // ── Notifications ─────────────────────────────────────────────────────────
  await boss.work<NotificationJobData>(
    "notifications",
    { localConcurrency: 5 },
    async (jobs: Job<NotificationJobData>[]) => {
      for (const job of jobs) {
        console.log(`[notifications] processing ${job.data.type} for user ${job.data.recipientUserId}`);
        await processNotification(job.data);
      }
    },
  );

  // ── dbt Transformation ────────────────────────────────────────────────────
  await boss.work<DbtTransformJobData>(
    "dbt-transform-jobs",
    { localConcurrency: 2 },
    async (jobs: Job<DbtTransformJobData>[]) => {
      for (const job of jobs) {
        const { calculationRunId, organizationId } = job.data;
        console.log(`[dbt-transform] processing calculation ${calculationRunId}`);
        await runDbtTransformation(calculationRunId, organizationId);
        console.log(`[dbt-transform] finished calculation ${calculationRunId}`);
      }
    },
  );

  // ── Invoice Anomaly Detection ────────────────────────────────────────────
  await boss.work<InvoiceAnomalyJobData>(
    "invoice-anomaly-jobs",
    { localConcurrency: 1 },
    async (jobs: Job<InvoiceAnomalyJobData>[]) => {
      for (const job of jobs) {
        const { organizationId } = job.data;
        console.log(`[invoice-anomaly] processing anomaly detection for org ${organizationId}`);
        await detectInvoiceAnomalies(organizationId);
        console.log(`[invoice-anomaly] finished anomaly detection for org ${organizationId}`);
      }
    },
  );

  // ── Supplier Performance ──────────────────────────────────────────────────
  await boss.work<SupplierPerformanceJobData>(
    "supplier-performance",
    { localConcurrency: 3 },
    async (jobs: Job<SupplierPerformanceJobData>[]) => {
      for (const job of jobs) {
        const { orgId, supplierId } = job.data;
        console.log(`[supplier-performance] updating metrics for supplier ${supplierId} in org ${orgId}`);
        await processSupplierPerformanceUpdate(orgId, supplierId);
        console.log(`[supplier-performance] finished updating supplier ${supplierId}`);
      }
    },
  );

  // ── Forecasting ───────────────────────────────────────────────────────────
  await boss.work<ForecastingJobData>(
    "forecasting",
    { localConcurrency: 2 },
    async (jobs: Job<ForecastingJobData>[]) => {
      for (const job of jobs) {
        const { orgId, forecastType } = job.data;
        console.log(`[forecasting] generating ${forecastType} forecast for org ${orgId}`);
        await processForecastingJob(job.data);
        console.log(`[forecasting] finished ${forecastType} forecast for org ${orgId}`);
      }
    },
  );

  // ── Causal Analysis ───────────────────────────────────────────────────────
  await boss.work<CausalAnalysisJobData>(
    "causal-analysis",
    { localConcurrency: 2 },
    async (jobs: Job<CausalAnalysisJobData>[]) => {
      for (const job of jobs) {
        const { causalInferenceRunId, orgId } = job.data;
        console.log(`[causal-analysis] processing run ${causalInferenceRunId}`);
        await processCausalAnalysisRun(causalInferenceRunId, orgId);
        console.log(`[causal-analysis] finished run ${causalInferenceRunId}`);
      }
    },
  );

  console.log("pg-boss workers started (imports, calculations, reports, notifications, dbt-transform, invoice-anomaly, supplier-performance, forecasting, causal-analysis)");
}

start().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
