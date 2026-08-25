import { prisma } from "@/lib/db";

export interface FailedJob {
  id: string;
  organizationId: string;
  jobType: "import" | "calculation" | "report" | "notification" | "xero-sync";
  resourceId: string;
  resourceType: string;
  error: string;
  retryCount: number;
  maxRetries: number;
  status: "failed" | "retrying" | "abandoned";
  failedAt: Date;
  lastRetryAt?: Date;
  nextRetryAt?: Date;
  metadata?: Record<string, any>;
}

// In-memory failed job store
const failedJobStore = new Map<string, FailedJob>();

/**
 * Record a failed job for retry
 */
export function recordFailedJob(
  organizationId: string,
  jobType: FailedJob["jobType"],
  resourceId: string,
  resourceType: string,
  error: string,
  metadata?: Record<string, any>
): FailedJob {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();

  const job: FailedJob = {
    id: jobId,
    organizationId,
    jobType,
    resourceId,
    resourceType,
    error,
    retryCount: 0,
    maxRetries: 3,
    status: "failed",
    failedAt: now,
    nextRetryAt: new Date(now.getTime() + 5000), // 5 seconds
    metadata,
  };

  failedJobStore.set(jobId, job);
  return job;
}

/**
 * Retry a failed job with exponential backoff
 */
export function retryFailedJob(jobId: string): boolean {
  const job = failedJobStore.get(jobId);
  if (!job) return false;

  if (job.retryCount >= job.maxRetries) {
    job.status = "abandoned";
    return false;
  }

  job.retryCount++;
  job.status = "retrying";
  job.lastRetryAt = new Date();

  // Exponential backoff with jitter: 5s, 20s, 80s, max 1 hour
  const baseDelay = Math.min(5000 * Math.pow(2, job.retryCount - 1), 3600000);
  const jitter = Math.random() * 0.1 * baseDelay;
  job.nextRetryAt = new Date(Date.now() + baseDelay + jitter);

  return true;
}

/**
 * Get failed jobs for an organization
 */
export function getFailedJobsForOrg(
  organizationId: string,
  filter?: { status?: FailedJob["status"]; jobType?: FailedJob["jobType"] }
): FailedJob[] {
  return Array.from(failedJobStore.values())
    .filter((job) => {
      if (job.organizationId !== organizationId) return false;
      if (filter?.status && job.status !== filter.status) return false;
      if (filter?.jobType && job.jobType !== filter.jobType) return false;
      return true;
    })
    .sort((a, b) => b.failedAt.getTime() - a.failedAt.getTime());
}

/**
 * Get statistics for failed jobs
 */
export function getFailedJobStats(organizationId?: string) {
  const jobs = organizationId
    ? getFailedJobsForOrg(organizationId)
    : Array.from(failedJobStore.values());

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
  };
}

/**
 * Cleanup abandoned jobs older than 30 days
 */
export function cleanupAbandonedJobs(): number {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const toDelete: string[] = [];

  for (const [id, job] of failedJobStore.entries()) {
    if (job.status === "abandoned" && job.failedAt < cutoff) {
      toDelete.push(id);
    }
  }

  toDelete.forEach((id) => failedJobStore.delete(id));
  return toDelete.length;
}

/**
 * Manually dismiss/resolve a failed job
 */
export function dismissFailedJob(jobId: string): boolean {
  const job = failedJobStore.get(jobId);
  if (!job) return false;
  failedJobStore.delete(jobId);
  return true;
}
