// Job queue using pg-boss — no Redis required, uses the existing Postgres instance.
// The web process calls these enqueue functions. The worker process (workers/index.ts) processes them.

import { boss, ensureBossStarted } from "../boss";

const retry = { retryLimit: 3, retryDelay: 2, retryBackoff: true } as const;
const retryAggressive = { retryLimit: 5, retryDelay: 1, retryBackoff: true } as const;

export type ImportJobData = { importBatchId: string; orgId: string };
export type CalculationJobData = { calculationRunId: string; orgId: string };
export type ReportJobData = { reportId: string; orgId: string; snapshotId: string };
export type NotificationJobData = {
  type:
    | "task_assigned"
    | "import_failed"
    | "report_ready"
    | "submission_reviewed"
    | "submission_received";
  recipientUserId: string;
  orgId: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
};

export type XeroSyncJobData = {
  orgId: string;
  fromDate?: string;
};

export async function enqueueImport(data: ImportJobData) {
  await ensureBossStarted();
  await boss.send("imports", data, retry);
}

export async function enqueueCalculation(data: CalculationJobData) {
  await ensureBossStarted();
  await boss.send("calculations", data, retry);
}

export async function enqueueReport(data: ReportJobData) {
  await ensureBossStarted();
  await boss.send("reports", data, retry);
}

export async function enqueueNotification(data: NotificationJobData) {
  await ensureBossStarted();
  await boss.send("notifications", data, retryAggressive);
}

export async function enqueueXeroSync(data: XeroSyncJobData) {
  await ensureBossStarted();
  await boss.send("xero-sync", data, retry);
}
