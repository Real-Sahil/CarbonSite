import { prisma } from "@/lib/db";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { enqueueInvoiceAnomalyDetection } from "@/lib/jobs/queues";

/**
 * Fetch invoices from QuickBooks API via OAuth refresh token.
 * Requires QuickBooks SDK to be installed and configured.
 */
export async function syncQuickBooksInvoices(
  organizationId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fromDate?: string
): Promise<{ created: number; updated: number; skipped: number }> {
  console.log(`[QB Sync] Starting sync for org ${organizationId}`);

  const config = await prisma.integrationConfig.findUnique({
    where: { organizationId },
    select: {
      quickbooksConnected: true,
      quickbooksRefreshToken: true,
      quickbooksRealmId: true,
      quickbooksTokenExpiresAt: true,
    },
  });

  if (!config || !config.quickbooksConnected || !config.quickbooksRefreshToken) {
    throw new Error(`QuickBooks not configured for org ${organizationId}`);
  }

  // TODO: Implement QB SDK integration
  // Steps:
  // 1. Refresh OAuth token using refresh token (similar to Xero pattern)
  // 2. Query QB Invoice endpoint with filters
  // 3. Transform QB invoice schema to internal format
  // 4. Deduplicate using QuickBooksSyncLog table
  // 5. Insert/update invoice records
  // 6. Create sync log entries
  // 7. Enqueue anomaly detection if created > 0

  throw new Error("QuickBooks sync not yet implemented. SDK integration required.");
}
