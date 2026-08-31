/**
 * Scheduling logic for 2x daily accounting sync across all connected orgs.
 * Intended to be called via:
 * 1. GitHub Actions workflow (0 6,18 * * * UTC = 6am/6pm)
 * 2. External cron service (Vercel Crons, EasyCron, etc.)
 * 3. Scheduled pg-boss job (via /api/admin/schedule/accounting-sync endpoint)
 */

import { prisma } from "@/lib/db";
import {
  enqueueXeroSync,
  enqueueQuickBooksSync,
  enqueueSageSync,
} from "@/lib/jobs/queues";

export interface AccountingSyncScheduleResult {
  timestamp: string;
  totalOrgs: number;
  xeroOrgs: number;
  quickbooksOrgs: number;
  sageOrgs: number;
  jobsQueued: number;
  errors: Array<{ orgId: string; provider: string; error: string }>;
}

/**
 * Enqueue sync jobs for all orgs with connected accounting integrations.
 * Safe to call multiple times - jobs are idempotent via pg-boss retry logic.
 */
export async function scheduleAccountingSyncForAllOrgs(): Promise<AccountingSyncScheduleResult> {
  const result: AccountingSyncScheduleResult = {
    timestamp: new Date().toISOString(),
    totalOrgs: 0,
    xeroOrgs: 0,
    quickbooksOrgs: 0,
    sageOrgs: 0,
    jobsQueued: 0,
    errors: [],
  };

  // Query all orgs with active integrations
  const configs = await prisma.integrationConfig.findMany({
    where: {
      OR: [
        { xeroConnected: true },
        { quickbooksConnected: true },
        { sageConnected: true },
      ],
    },
    select: {
      organizationId: true,
      xeroConnected: true,
      quickbooksConnected: true,
      sageConnected: true,
    },
  });

  result.totalOrgs = configs.length;

  // Enqueue sync jobs for each provider
  for (const config of configs) {
    try {
      if (config.xeroConnected) {
        await enqueueXeroSync({ orgId: config.organizationId });
        result.xeroOrgs++;
        result.jobsQueued++;
        console.log(`[scheduler] Queued Xero sync for org ${config.organizationId}`);
      }
    } catch (err) {
      result.errors.push({
        orgId: config.organizationId,
        provider: "xero",
        error: err instanceof Error ? err.message : String(err),
      });
      console.error(`[scheduler] Failed to queue Xero sync for org ${config.organizationId}:`, err);
    }

    try {
      if (config.quickbooksConnected) {
        await enqueueQuickBooksSync({ orgId: config.organizationId });
        result.quickbooksOrgs++;
        result.jobsQueued++;
        console.log(`[scheduler] Queued QuickBooks sync for org ${config.organizationId}`);
      }
    } catch (err) {
      result.errors.push({
        orgId: config.organizationId,
        provider: "quickbooks",
        error: err instanceof Error ? err.message : String(err),
      });
      console.error(`[scheduler] Failed to queue QuickBooks sync for org ${config.organizationId}:`, err);
    }

    try {
      if (config.sageConnected) {
        await enqueueSageSync({ orgId: config.organizationId });
        result.sageOrgs++;
        result.jobsQueued++;
        console.log(`[scheduler] Queued Sage sync for org ${config.organizationId}`);
      }
    } catch (err) {
      result.errors.push({
        orgId: config.organizationId,
        provider: "sage",
        error: err instanceof Error ? err.message : String(err),
      });
      console.error(`[scheduler] Failed to queue Sage sync for org ${config.organizationId}:`, err);
    }
  }

  console.log(
    `[scheduler] Accounting sync scheduled: ${result.jobsQueued} jobs queued across ${result.totalOrgs} orgs (xero=${result.xeroOrgs}, qb=${result.quickbooksOrgs}, sage=${result.sageOrgs})`
  );

  return result;
}
