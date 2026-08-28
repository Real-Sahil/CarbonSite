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
  DsarJobData,
  UptimeMonitoringJobData,
  DsarSlaMonitoringJobData,
  AccountPoliciesJobData,
  AirbyteSyncJobData,
  SupplierPerformanceJobData,
  InvoiceAnomalyJobData,
} from "@/lib/jobs/queues/index";
import { processImportBatch } from "@/lib/imports/worker";
import { processCalculationRun } from "@/lib/calculation/run-worker";
import { processNotification } from "@/lib/notifications/worker";
import { processReport } from "@/lib/reports/worker";
import { processDsarExport } from "./dsar-export";
import { processDsarErasure } from "./dsar-erasure";
import { processUptimeMonitoring } from "./uptime-monitoring";
import { processDsarSlaMonitoring } from "./dsar-sla-monitoring";
import { processAccountPolicies } from "./account-policies";
import { handleAirbyteSyncJob } from "@/lib/jobs/workers/airbyte-sync";
import { processSupplierPerformanceUpdate } from "@/lib/jobs/workers/supplier-performance";
import { detectInvoiceAnomalies } from "@/lib/jobs/workers/invoice-anomaly-detector";
import { workerLogger } from "@/lib/logger";

const boss = new PgBoss({
  connectionString: process.env.DATABASE_URL!,
  max: 10,
});

boss.on("error", (err: Error) => workerLogger.error("pg-boss error", { error: err.message, stack: err.stack }));

async function start() {
  await boss.start();

  // ── Imports ──────────────────────────────────────────────────────────────
  await boss.work<ImportJobData>(
    "imports",
    { localConcurrency: 2 },
    async (jobs: Job<ImportJobData>[]) => {
      for (const job of jobs) {
        const { importBatchId, orgId } = job.data;
        try {
          workerLogger.info("Import batch processing started", { importBatchId, orgId });
          await processImportBatch(importBatchId, orgId);
          workerLogger.info("Import batch processing completed", { importBatchId, orgId });
        } catch (error) {
          workerLogger.error("Import batch processing failed", {
            importBatchId,
            orgId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          throw error;
        }
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
        try {
          workerLogger.info("Calculation run processing started", { calculationRunId, orgId });
          await processCalculationRun(calculationRunId, orgId);
          workerLogger.info("Calculation run processing completed", { calculationRunId, orgId });
        } catch (error) {
          workerLogger.error("Calculation run processing failed", {
            calculationRunId,
            orgId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          throw error;
        }
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
        try {
          workerLogger.info("Report processing started", { reportId, orgId });
          await processReport(reportId, orgId);
          workerLogger.info("Report processing completed", { reportId, orgId });
        } catch (error) {
          workerLogger.error("Report processing failed", {
            reportId,
            orgId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          throw error;
        }
      }
    },
  );

  // ── Notifications ─────────────────────────────────────────────────────────
  await boss.work<NotificationJobData>(
    "notifications",
    { localConcurrency: 5 },
    async (jobs: Job<NotificationJobData>[]) => {
      for (const job of jobs) {
        try {
          workerLogger.info("Notification processing started", {
            type: job.data.type,
            recipientUserId: job.data.recipientUserId,
            orgId: job.data.orgId,
          });
          await processNotification(job.data);
          workerLogger.info("Notification processing completed", {
            type: job.data.type,
            recipientUserId: job.data.recipientUserId,
          });
        } catch (error) {
          workerLogger.error("Notification processing failed", {
            type: job.data.type,
            recipientUserId: job.data.recipientUserId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          throw error;
        }
      }
    },
  );

  // ── DSAR export/erasure ──────────────────────────────────────────────────
  // Concurrency of 1: each job runs many sequential queries across the PII
  // registry against a pooled client with connection_limit=2 (lib/db/index.ts)
  // — running these in parallel would just contend for the same two slots.
  await boss.work<DsarJobData>(
    "dsar-export",
    { localConcurrency: 1 },
    async (jobs: Job<DsarJobData>[]) => {
      for (const job of jobs) {
        console.log(`[dsar-export] processing request ${job.data.dsarRequestId}`);
        await processDsarExport(job.data.dsarRequestId);
        console.log(`[dsar-export] finished request ${job.data.dsarRequestId}`);
      }
    },
  );

  await boss.work<DsarJobData>(
    "dsar-erasure",
    { localConcurrency: 1 },
    async (jobs: Job<DsarJobData>[]) => {
      for (const job of jobs) {
        console.log(`[dsar-erasure] processing request ${job.data.dsarRequestId}`);
        await processDsarErasure(job.data.dsarRequestId);
        console.log(`[dsar-erasure] finished request ${job.data.dsarRequestId}`);
      }
    },
  );

  // ── Uptime Monitoring ────────────────────────────────────────────────────
  await boss.work<UptimeMonitoringJobData>(
    "uptime-monitoring",
    { localConcurrency: 1 },
    async () => {
      console.log("[uptime-monitoring] running health check");
      await processUptimeMonitoring();
    },
  );

  // Schedule the recurring health check: every 5 minutes (cron: */5 * * * *)
  // pg-boss schedules run at the worker's local timezone
  await boss.schedule(
    "uptime-monitoring",
    "*/5 * * * *", // every 5 minutes
    {},
  );

  // ── DSAR SLA Monitoring ──────────────────────────────────────────────────
  await boss.work<DsarSlaMonitoringJobData>(
    "dsar-sla-monitoring",
    { localConcurrency: 1 },
    async () => {
      console.log("[dsar-sla-monitoring] checking DSAR request SLAs");
      await processDsarSlaMonitoring();
    },
  );

  // Schedule daily DSAR SLA check: 2 AM UTC (cron: 0 2 * * *)
  await boss.schedule(
    "dsar-sla-monitoring",
    "0 2 * * *", // daily at 2 AM UTC
    {},
  );

  // ── Account Policies (password rotation, account expiry) ───────────────────
  await boss.work<AccountPoliciesJobData>(
    "account-policies",
    { localConcurrency: 1 },
    async () => {
      console.log("[account-policies] running policy checks");
      await processAccountPolicies();
    },
  );

  // Schedule nightly account policies check: 1 AM UTC (cron: 0 1 * * *)
  await boss.schedule(
    "account-policies",
    "0 1 * * *", // daily at 1 AM UTC
    {},
  );

  // ── Airbyte Sync Completion ──────────────────────────────────────────────
  await boss.work<AirbyteSyncJobData>(
    "airbyte-sync",
    { localConcurrency: 3 },
    async (jobs: Job<AirbyteSyncJobData>[]) => {
      for (const job of jobs) {
        const { connectionId } = job.data;
        console.log(`[airbyte-sync] processing connection ${connectionId}`);
        await handleAirbyteSyncJob(job);
      }
    },
  );

  // ── Supplier Performance Tracking ────────────────────────────────────────
  await boss.work<SupplierPerformanceJobData>(
    "supplier-performance",
    { localConcurrency: 5 },
    async (jobs: Job<SupplierPerformanceJobData>[]) => {
      for (const job of jobs) {
        const { orgId, supplierId } = job.data;
        console.log(`[supplier-performance] processing ${supplierId} for org ${orgId}`);
        await processSupplierPerformanceUpdate(orgId, supplierId);
      }
    },
  );

  // ── Invoice Anomaly Detection ────────────────────────────────────────────
  await boss.work<InvoiceAnomalyJobData>(
    "invoice-anomalies",
    { localConcurrency: 3 },
    async (jobs: Job<InvoiceAnomalyJobData>[]) => {
      for (const job of jobs) {
        const { orgId } = job.data;
        try {
          workerLogger.info("Invoice anomaly detection started", { orgId });
          const result = await detectInvoiceAnomalies(orgId);
          workerLogger.info("Invoice anomaly detection completed", {
            orgId,
            processedCount: result.processedCount,
            detectedCount: result.detectedCount
          });
        } catch (error) {
          workerLogger.error("Invoice anomaly detection failed", {
            orgId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          throw error;
        }
      }
    },
  );

  // Schedule invoice anomaly detection: daily at 3 AM UTC
  await boss.schedule(
    "invoice-anomalies",
    "0 3 * * *",
    { orgId: "scheduled" },
  );

  console.log(
    "pg-boss workers started (imports, calculations, reports, notifications, dsar-export, dsar-erasure, uptime-monitoring, dsar-sla-monitoring, account-policies, airbyte-sync, supplier-performance, invoice-anomalies)",
  );
}

start().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
