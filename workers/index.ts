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
} from "@/lib/jobs/queues/index";
import { processImportBatch } from "@/lib/imports/worker";
import { processCalculationRun } from "@/lib/calculation/run-worker";
import { processNotification } from "@/lib/notifications/worker";
import { processReport } from "@/lib/reports/worker";
import { runDbtTransformation } from "@/lib/jobs/workers/dbt-transform";
import type { DbtTransformJobData } from "@/lib/jobs/workers/dbt-transform";

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

  console.log("pg-boss workers started (imports, calculations, reports, notifications, dbt-transform)");
}

start().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
