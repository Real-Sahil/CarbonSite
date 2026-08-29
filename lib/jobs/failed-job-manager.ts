import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";

export interface FailedJobRecord {
  id: string;
  jobType: "import" | "calculation" | "report" | "notification" | "xero-sync";
  organizationId: string;
  resourceId?: string;
  error: string;
  errorStack?: string;
  retryCount: number;
  maxRetries: number;
  lastRetryAt?: Date;
  nextRetryAt?: Date;
  failedAt: Date;
  status: "failed" | "retrying" | "abandoned";
  metadata?: Record<string, unknown>;
}

// In-memory store for failed jobs (in production, use database table)
const failedJobs = new Map<string, FailedJobRecord>();

/**
 * Record a failed job for later retry.
 */
export async function recordFailedJob(
  jobType: FailedJobRecord["jobType"],
  organizationId: string,
  error: Error,
  context?: {
    resourceId?: string;
    retryCount?: number;
    maxRetries?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<string> {
  const jobId = `${jobType}_${organizationId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const failedJob: FailedJobRecord = {
    id: jobId,
    jobType,
    organizationId,
    resourceId: context?.resourceId,
    error: error.message,
    errorStack: error.stack,
    retryCount: context?.retryCount ?? 0,
    maxRetries: context?.maxRetries ?? 3,
    failedAt: new Date(),
    status: "failed",
    metadata: context?.metadata,
    nextRetryAt: new Date(Date.now() + exponentialBackoff(context?.retryCount ?? 0)),
  };

  failedJobs.set(jobId, failedJob);

  console.error(
    `[Failed Job] ${jobType} for org ${organizationId}: ${error.message}`
  );

  // Write audit log
  await writeAuditLog({
    organizationId,
    action: "job.failed",
    resourceId: jobId,
    resourceType: "job",
    metadata: {
      jobType,
      error: error.message,
      retryCount: failedJob.retryCount,
    },
  });

  return jobId;
}

/**
 * Get all failed jobs for an organization.
 */
export function getFailedJobsForOrg(
  organizationId: string,
  filter?: { status?: FailedJobRecord["status"]; jobType?: string }
): FailedJobRecord[] {
  return Array.from(failedJobs.values()).filter((job) => {
    if (job.organizationId !== organizationId) return false;
    if (filter?.status && job.status !== filter.status) return false;
    if (filter?.jobType && job.jobType !== filter.jobType) return false;
    return true;
  });
}

/**
 * Get a specific failed job.
 */
export function getFailedJob(jobId: string): FailedJobRecord | null {
  return failedJobs.get(jobId) ?? null;
}

/**
 * Retry a failed job.
 */
export async function retryFailedJob(
  jobId: string,
  retryHandler: (job: FailedJobRecord) => Promise<void>
): Promise<{ success: boolean; error?: string }> {
  const job = failedJobs.get(jobId);
  if (!job) {
    return { success: false, error: "Job not found" };
  }

  // Check if max retries exceeded
  if (job.retryCount >= job.maxRetries) {
    job.status = "abandoned";
    return {
      success: false,
      error: `Max retries (${job.maxRetries}) exceeded`,
    };
  }

  try {
    job.status = "retrying";
    job.retryCount++;
    job.lastRetryAt = new Date();
    job.nextRetryAt = new Date(
      Date.now() + exponentialBackoff(job.retryCount)
    );

    await retryHandler(job);

    // Remove from failed jobs if successful
    failedJobs.delete(jobId);

    console.log(`[Retry] Successfully retried job ${jobId}`);
    return { success: true };
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : String(error);

    console.error(`[Retry] Failed to retry job ${jobId}: ${job.error}`);
    return { success: false, error: job.error };
  }
}

/**
 * Abandon a failed job (mark as not retrying).
 */
export function abandonFailedJob(jobId: string): boolean {
  const job = failedJobs.get(jobId);
  if (!job) return false;

  job.status = "abandoned";
  console.log(`[Job Manager] Abandoned job ${jobId}`);
  return true;
}

/**
 * Get retryable jobs (status is failed and not yet at max retries).
 */
export function getRetryableJobs(): FailedJobRecord[] {
  const now = new Date();
  return Array.from(failedJobs.values()).filter(
    (job) =>
      job.status === "failed" &&
      job.retryCount < job.maxRetries &&
      job.nextRetryAt &&
      job.nextRetryAt <= now
  );
}

/**
 * Cleanup abandoned jobs older than 30 days.
 */
export function cleanupOldJobs(olderThanDays: number = 30): number {
  const cutoffTime = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const jobsToDelete = Array.from(failedJobs.values()).filter(
    (job) => job.status === "abandoned" && job.failedAt < cutoffTime
  );

  jobsToDelete.forEach((job) => failedJobs.delete(job.id));
  console.log(`[Job Manager] Cleaned up ${jobsToDelete.length} abandoned jobs`);
  return jobsToDelete.length;
}

/**
 * Calculate exponential backoff in milliseconds.
 */
function exponentialBackoff(retryCount: number): number {
  const baseDelay = 5000; // 5 seconds
  const maxDelay = 60 * 60 * 1000; // 1 hour
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  return delay + Math.random() * 1000; // Add jitter
}

/**
 * Get statistics on failed jobs.
 */
export function getFailedJobStats(organizationId?: string) {
  const jobs = organizationId
    ? getFailedJobsForOrg(organizationId)
    : Array.from(failedJobs.values());

  return {
    total: jobs.length,
    byStatus: {
      failed: jobs.filter((j) => j.status === "failed").length,
      retrying: jobs.filter((j) => j.status === "retrying").length,
      abandoned: jobs.filter((j) => j.status === "abandoned").length,
    },
    byType: {
      import: jobs.filter((j) => j.jobType === "import").length,
      calculation: jobs.filter((j) => j.jobType === "calculation").length,
      report: jobs.filter((j) => j.jobType === "report").length,
      notification: jobs.filter((j) => j.jobType === "notification").length,
      "xero-sync": jobs.filter((j) => j.jobType === "xero-sync").length,
    },
    oldestJob: jobs.sort((a, b) => a.failedAt.getTime() - b.failedAt.getTime())[0],
  };
}
