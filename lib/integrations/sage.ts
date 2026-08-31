import { prisma } from "@/lib/db";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { enqueueInvoiceAnomalyDetection } from "@/lib/jobs/queues";

/**
 * Fetch invoices from Sage API via OAuth refresh token.
 * Requires Sage SDK to be installed and configured.
 */
export async function syncSageInvoices(
  organizationId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fromDate?: string
): Promise<{ created: number; updated: number; skipped: number }> {
  console.log(`[Sage Sync] Starting sync for org ${organizationId}`);

  const config = await prisma.integrationConfig.findUnique({
    where: { organizationId },
    select: {
      sageConnected: true,
      sageRefreshToken: true,
      sageTenantId: true,
      sageTokenExpiresAt: true,
    },
  });

  if (!config || !config.sageConnected || !config.sageRefreshToken) {
    throw new Error(`Sage not configured for org ${organizationId}`);
  }

  // TODO: Implement Sage SDK integration
  // Steps:
  // 1. Refresh OAuth token using refresh token (similar to Xero pattern)
  // 2. Query Sage Invoice endpoint with filters
  // 3. Transform Sage invoice schema to internal format
  // 4. Deduplicate using SageSyncLog table
  // 5. Insert/update invoice records
  // 6. Create sync log entries
  // 7. Enqueue anomaly detection if created > 0

  throw new Error("Sage sync not yet implemented. SDK integration required.");
}
