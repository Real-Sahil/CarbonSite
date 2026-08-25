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
} from "@/lib/jobs/queues/index";
import { processImportBatch } from "@/lib/imports/worker";
import { processCalculationRun } from "@/lib/calculation/run-worker";
import { processNotification } from "@/lib/notifications/worker";
import { processReport } from "@/lib/reports/worker";
import { processDsarExport } from "./dsar-export";
import { processDsarErasure } from "./dsar-erasure";
import { processUptimeMonitoring } from "./uptime-monitoring";

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

  console.log(
    "pg-boss workers started (imports, calculations, reports, notifications, dsar-export, dsar-erasure, uptime-monitoring)",
  );
}

start().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
