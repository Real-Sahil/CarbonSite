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
        console.log("[calculations] processing:", job.data);
        // TODO: normalizeUnit() → selectFactor() → computeCo2e()
        // → persist immutable EmissionCalculation rows
        // → rebuild DashboardAggregate
      }
    },
  );

  // ── Reports ───────────────────────────────────────────────────────────────
  await boss.work<ReportJobData>(
    "reports",
    { localConcurrency: 1 },
    async (jobs: Job<ReportJobData>[]) => {
      for (const job of jobs) {
        console.log("[reports] processing:", job.data);
        // TODO: read PublishedSnapshot → Puppeteer PDF + CSV
        // → upload to R2 with checksum → update Report.status = 'ready'
      }
    },
  );

  // ── Notifications ─────────────────────────────────────────────────────────
  await boss.work<NotificationJobData>(
    "notifications",
    { localConcurrency: 5 },
    async (jobs: Job<NotificationJobData>[]) => {
      for (const job of jobs) {
        console.log("[notifications] processing:", job.data);
        // TODO: look up recipient email → send via Resend
        // → send FCM push notification if device token exists
      }
    },
  );

  console.log("pg-boss workers started (imports, calculations, reports, notifications)");
}

start().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
