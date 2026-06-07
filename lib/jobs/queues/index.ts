// Job queue using pg-boss — no Redis required, uses the existing Postgres instance.
// The web process calls these enqueue functions. The worker process (workers/index.ts) processes them.

import { boss } from "../boss";

const retry = { retryLimit: 3, retryDelay: 2, retryBackoff: true } as const;
const retryAggressive = { retryLimit: 5, retryDelay: 1, retryBackoff: true } as const;

export type ImportJobData = { importBatchId: string; orgId: string };
export type CalculationJobData = { calculationRunId: string; orgId: string };
export type ReportJobData = { reportId: string; orgId: string; snapshotId: string };
export type NotificationJobData = {
  type: "task_assigned" | "import_failed" | "report_ready" | "submission_reviewed";
  recipientUserId: string;
  orgId: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
};

export async function enqueueImport(data: ImportJobData) {
  await boss.send("imports", data, retry);
}

export async function enqueueCalculation(data: CalculationJobData) {
  await boss.send("calculations", data, retry);
}

export async function enqueueReport(data: ReportJobData) {
  await boss.send("reports", data, retry);
}

export async function enqueueNotification(data: NotificationJobData) {
  await boss.send("notifications", data, retryAggressive);
}
