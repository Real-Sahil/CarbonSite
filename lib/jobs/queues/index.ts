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
    | "submission_received"
    | "supplier_password_expiring"
    | "supplier_account_terminated"
    | "supplier_account_expiring"
    | "dsar_sla_alert"
    | "security_alert";
  recipientUserId: string;
  orgId: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
};
export type DsarJobData = { dsarRequestId: string };
export type UptimeMonitoringJobData = { checkId?: string };
export type DsarSlaMonitoringJobData = Record<string, never>;
export type AccountPoliciesJobData = Record<string, never>;
export type SupplierPerformanceJobData = { orgId: string; supplierId: string };
export type InvoiceAnomalyJobData = { orgId: string };
export type XeroSyncJobData = { orgId: string; fromDate?: string };
export type QuickBooksSyncJobData = { orgId: string; fromDate?: string };
export type SageSyncJobData = { orgId: string; fromDate?: string };
export type CausalAnalysisJobData = { causalInferenceRunId: string; orgId: string };
export type ForecastingJobData = {
  orgId: string;
  forecastType: "emissions" | "supplier_quality" | "anomaly_rate";
  lookbackMonths?: number;
  forecastMonths?: number;
};

export async function enqueueImport(data: ImportJobData) {
  await ensureBossStarted();
  await boss.send("imports", data, retry);
}

export async function enqueueCalculation(data: CalculationJobData): Promise<string | null> {
  await ensureBossStarted();
  const jobId = await boss.send("calculations", data, retry);
  return jobId;
}

export async function enqueueReport(data: ReportJobData) {
  await ensureBossStarted();
  await boss.send("reports", data, retry);
}

export async function enqueueNotification(data: NotificationJobData) {
  await ensureBossStarted();
  await boss.send("notifications", data, retryAggressive);
}

export async function enqueueDsarExport(data: DsarJobData) {
  await ensureBossStarted();
  await boss.send("dsar-export", data, retry);
}

export async function enqueueDsarErasure(data: DsarJobData) {
  await ensureBossStarted();
  await boss.send("dsar-erasure", data, retry);
}

export async function enqueueAccountPoliciesCheck(data: AccountPoliciesJobData) {
  await ensureBossStarted();
  await boss.send("account-policies", data, retry);
}

export async function enqueueSupplierPerformanceUpdate(data: SupplierPerformanceJobData) {
  await ensureBossStarted();
  await boss.send("supplier-performance", data, retry);
}

export async function enqueueInvoiceAnomalyDetection(data: InvoiceAnomalyJobData) {
  await ensureBossStarted();
  await boss.send("invoice-anomaly-jobs", data, retry);
}

export async function enqueueXeroSync(data: XeroSyncJobData) {
  await ensureBossStarted();
  await boss.send("xero-sync", data, retry);
}

export async function enqueueQuickBooksSync(data: QuickBooksSyncJobData) {
  await ensureBossStarted();
  await boss.send("quickbooks-sync", data, retry);
}

export async function enqueueSageSync(data: SageSyncJobData) {
  await ensureBossStarted();
  await boss.send("sage-sync", data, retry);
}

export async function enqueueCausalAnalysis(data: CausalAnalysisJobData) {
  await ensureBossStarted();
  await boss.send("causal-analysis", data, retry);
}

export async function enqueueForecasting(data: ForecastingJobData) {
  await ensureBossStarted();
  await boss.send("forecasting", data, retry);
}
