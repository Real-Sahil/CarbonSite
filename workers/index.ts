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
  XeroSyncJobData,
  QuickBooksSyncJobData,
  SageSyncJobData,
  InvoiceAnomalyJobData,
} from "@/lib/jobs/queues/index";
import { enqueueInvoiceAnomalyDetection } from "@/lib/jobs/queues/index";
import { processImportBatch } from "@/lib/imports/worker";
import { processCalculationRun } from "@/lib/calculation/run-worker";
import { prisma } from "@/lib/db";
import { processNotification } from "@/lib/notifications/worker";
import { processReport } from "@/lib/reports/worker";
import { runDbtTransformation } from "@/lib/jobs/workers/dbt-transform";
import type { DbtTransformJobData } from "@/lib/jobs/workers/dbt-transform";
import { detectInvoiceAnomalies } from "@/lib/jobs/workers/invoice-anomaly-detector";
import { processSupplierPerformanceUpdate } from "@/lib/jobs/workers/supplier-performance";
import { processForecastingJob } from "@/lib/jobs/workers/forecasting";
import type { ForecastingJobData } from "@/lib/jobs/workers/forecasting";
import { processCausalAnalysisRun } from "@/lib/jobs/workers/causal-analysis";
import { syncXeroInvoices } from "@/lib/integrations/xero";
import { syncQuickBooksInvoices } from "@/lib/integrations/quickbooks";
import { syncSageInvoices } from "@/lib/integrations/sage";
import { getLogger } from "@/lib/observability";

interface SupplierPerformanceJobData {
  orgId: string;
  supplierId: string;
}

const boss = new PgBoss({
  connectionString: process.env.DATABASE_URL!,
  max: 10,
});

const workerLogger = getLogger("worker");

boss.on("error", (err: Error) => workerLogger.error("pg-boss internal error", err));

async function start() {
  await boss.start();

  // ── Imports ──────────────────────────────────────────────────────────────
  const importsLogger = getLogger("imports");
  await boss.work<ImportJobData>(
    "imports",
    { localConcurrency: 2 },
    async (jobs: Job<ImportJobData>[]) => {
      for (const job of jobs) {
        const { importBatchId, orgId } = job.data;
        importsLogger.info("processing batch", { importBatchId, orgId });
        await processImportBatch(importBatchId, orgId);
        importsLogger.info("finished batch", { importBatchId, orgId });
      }
    },
  );

  // ── Calculations ──────────────────────────────────────────────────────────
  const calculationsLogger = getLogger("calculations");
  await boss.work<CalculationJobData>(
    "calculations",
    { localConcurrency: 4 },
    async (jobs: Job<CalculationJobData>[]) => {
      for (const job of jobs) {
        const { calculationRunId, orgId } = job.data;
        calculationsLogger.info("processing run", { calculationRunId, orgId });
        // processCalculationRun() processes one bounded chunk per call (so a
        // single invocation can never run long enough to hit a serverless
        // timeout — see lib/calculation/run-worker.ts). A persistent worker
        // has no such timeout, so keep calling it until the run reaches a
        // terminal status instead of leaving it after just one chunk.
        // A call returns {done:false} either because more chunks remain
        // (this loop keeps going) or because it couldn't claim the run at
        // all (already terminal, or another invocation currently holds it —
        // check status directly to tell those apart, with a short backoff
        // before retrying a busy claim, so this never spins hot forever).
        for (;;) {
          const result = await processCalculationRun(calculationRunId, orgId);
          if (result.done) break;
          const current = await prisma.calculationRun.findUnique({
            where: { id: calculationRunId },
            select: { status: true },
          });
          if (!current || current.status === "succeeded" || current.status === "failed") break;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        calculationsLogger.info("finished run", { calculationRunId, orgId });
      }
    },
  );

  // ── Reports ───────────────────────────────────────────────────────────────
  const reportsLogger = getLogger("reports");
  await boss.work<ReportJobData>(
    "reports",
    { localConcurrency: 1 },
    async (jobs: Job<ReportJobData>[]) => {
      for (const job of jobs) {
        const { reportId, orgId } = job.data;
        reportsLogger.info("processing report", { reportId, orgId });
        await processReport(reportId, orgId);
        reportsLogger.info("finished report", { reportId, orgId });
      }
    },
  );

  // ── Notifications ─────────────────────────────────────────────────────────
  const notificationsLogger = getLogger("notifications");
  await boss.work<NotificationJobData>(
    "notifications",
    { localConcurrency: 5 },
    async (jobs: Job<NotificationJobData>[]) => {
      for (const job of jobs) {
        notificationsLogger.info("processing notification", {
          type: job.data.type,
          recipientUserId: job.data.recipientUserId,
        });
        await processNotification(job.data);
      }
    },
  );

  // ── dbt Transformation ────────────────────────────────────────────────────
  const dbtLogger = getLogger("dbt-transform");
  await boss.work<DbtTransformJobData>(
    "dbt-transform-jobs",
    { localConcurrency: 2 },
    async (jobs: Job<DbtTransformJobData>[]) => {
      for (const job of jobs) {
        const { calculationRunId, organizationId } = job.data;
        dbtLogger.info("processing calculation", { calculationRunId, organizationId });
        await runDbtTransformation(calculationRunId, organizationId);
        dbtLogger.info("finished calculation", { calculationRunId, organizationId });
      }
    },
  );

  // ── Invoice Anomaly Detection ────────────────────────────────────────────
  const invoiceAnomalyLogger = getLogger("invoice-anomaly");
  await boss.work<InvoiceAnomalyJobData>(
    "invoice-anomaly-jobs",
    { localConcurrency: 1 },
    async (jobs: Job<InvoiceAnomalyJobData>[]) => {
      for (const job of jobs) {
        const { orgId } = job.data;
        invoiceAnomalyLogger.info("processing anomaly detection", { orgId });
        await detectInvoiceAnomalies(orgId);
        invoiceAnomalyLogger.info("finished anomaly detection", { orgId });
      }
    },
  );

  // ── Xero Invoice Sync ─────────────────────────────────────────────────────
  const xeroLogger = getLogger("xero-sync");
  await boss.work<XeroSyncJobData>(
    "xero-sync",
    { localConcurrency: 2 },
    async (jobs: Job<XeroSyncJobData>[]) => {
      for (const job of jobs) {
        const { orgId, fromDate } = job.data;
        xeroLogger.info("processing sync", { orgId, fromDate });
        try {
          const result = await syncXeroInvoices(orgId, fromDate);
          xeroLogger.info("finished sync", {
            orgId,
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
          });
          if (result.created > 0) {
            await enqueueInvoiceAnomalyDetection({ orgId });
          }
        } catch (err) {
          xeroLogger.error("failed sync", err, { orgId });
          throw err;
        }
      }
    },
  );

  // ── QuickBooks Invoice Sync ───────────────────────────────────────────────
  const quickbooksLogger = getLogger("quickbooks-sync");
  await boss.work<QuickBooksSyncJobData>(
    "quickbooks-sync",
    { localConcurrency: 2 },
    async (jobs: Job<QuickBooksSyncJobData>[]) => {
      for (const job of jobs) {
        const { orgId, fromDate } = job.data;
        quickbooksLogger.info("processing sync", { orgId, fromDate });
        try {
          const result = await syncQuickBooksInvoices(orgId, fromDate);
          quickbooksLogger.info("finished sync", {
            orgId,
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
          });
        } catch (err) {
          quickbooksLogger.error("failed sync", err, { orgId });
          throw err;
        }
      }
    },
  );

  // ── Sage Invoice Sync ─────────────────────────────────────────────────────
  const sageLogger = getLogger("sage-sync");
  await boss.work<SageSyncJobData>(
    "sage-sync",
    { localConcurrency: 2 },
    async (jobs: Job<SageSyncJobData>[]) => {
      for (const job of jobs) {
        const { orgId, fromDate } = job.data;
        sageLogger.info("processing sync", { orgId, fromDate });
        try {
          const result = await syncSageInvoices(orgId, fromDate);
          sageLogger.info("finished sync", {
            orgId,
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
          });
        } catch (err) {
          sageLogger.error("failed sync", err, { orgId });
          throw err;
        }
      }
    },
  );

  // ── Supplier Performance ──────────────────────────────────────────────────
  const supplierPerfLogger = getLogger("supplier-performance");
  await boss.work<SupplierPerformanceJobData>(
    "supplier-performance",
    { localConcurrency: 3 },
    async (jobs: Job<SupplierPerformanceJobData>[]) => {
      for (const job of jobs) {
        const { orgId, supplierId } = job.data;
        supplierPerfLogger.info("updating metrics", { orgId, supplierId });
        await processSupplierPerformanceUpdate(orgId, supplierId);
        supplierPerfLogger.info("finished updating supplier", { orgId, supplierId });
      }
    },
  );

  // ── Forecasting ───────────────────────────────────────────────────────────
  const forecastingLogger = getLogger("forecasting");
  await boss.work<ForecastingJobData>(
    "forecasting",
    { localConcurrency: 2 },
    async (jobs: Job<ForecastingJobData>[]) => {
      for (const job of jobs) {
        const { orgId, forecastType } = job.data;
        forecastingLogger.info("generating forecast", { orgId, forecastType });
        await processForecastingJob(job.data);
        forecastingLogger.info("finished forecast", { orgId, forecastType });
      }
    },
  );

  // ── Causal Analysis ───────────────────────────────────────────────────────
  const causalLogger = getLogger("causal-analysis");
  await boss.work<CausalAnalysisJobData>(
    "causal-analysis",
    { localConcurrency: 2 },
    async (jobs: Job<CausalAnalysisJobData>[]) => {
      for (const job of jobs) {
        const { causalInferenceRunId, orgId } = job.data;
        causalLogger.info("processing run", { causalInferenceRunId, orgId });
        await processCausalAnalysisRun(causalInferenceRunId, orgId);
        causalLogger.info("finished run", { causalInferenceRunId, orgId });
      }
    },
  );

  workerLogger.info("pg-boss workers started", {
    queues: [
      "imports", "calculations", "reports", "notifications",
      "dbt-transform", "invoice-anomaly", "xero-sync", "quickbooks-sync",
      "sage-sync", "supplier-performance", "forecasting", "causal-analysis",
    ],
  });
}

start().catch((err) => {
  workerLogger.error("Worker failed to start", err);
  process.exit(1);
});
