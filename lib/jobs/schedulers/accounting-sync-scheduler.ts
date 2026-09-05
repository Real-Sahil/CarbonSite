/**
 * Scheduling logic for 2x daily accounting sync across all connected orgs.
 * Intended to be called via:
 * 1. GitHub Actions workflow (0 6,18 * * * UTC = 6am/6pm)
 * 2. External cron service (Vercel Crons, EasyCron, etc.)
 * 3. Scheduled pg-boss job (via /api/admin/schedule/accounting-sync endpoint)
 */

import { prisma } from "@/lib/db";
import { dispatchXeroSync } from "@/lib/jobs/dispatch";
import { syncQuickBooksInvoices } from "@/lib/integrations/quickbooks";
import { syncSageInvoices } from "@/lib/integrations/sage";

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
        await dispatchXeroSync({ orgId: config.organizationId });
        result.xeroOrgs++;
        result.jobsQueued++;
        console.log(`[scheduler] Ran Xero sync for org ${config.organizationId}`);
      }
    } catch (err) {
      result.errors.push({
        orgId: config.organizationId,
        provider: "xero",
        error: err instanceof Error ? err.message : String(err),
      });
      console.error(`[scheduler] Failed to run Xero sync for org ${config.organizationId}:`, err);
    }

    // QuickBooks and Sage invoice sync aren't implemented yet (no SDK
    // integration) — skip them rather than pretending a job was queued.
    if (config.quickbooksConnected) {
      await syncQuickBooksInvoices(config.organizationId).catch((err) => {
        result.errors.push({
          orgId: config.organizationId,
          provider: "quickbooks",
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
    if (config.sageConnected) {
      await syncSageInvoices(config.organizationId).catch((err) => {
        result.errors.push({
          orgId: config.organizationId,
          provider: "sage",
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
  }

  console.log(
    `[scheduler] Accounting sync scheduled: ${result.jobsQueued} jobs queued across ${result.totalOrgs} orgs (xero=${result.xeroOrgs}, qb=${result.quickbooksOrgs}, sage=${result.sageOrgs})`
  );

  return result;
}
