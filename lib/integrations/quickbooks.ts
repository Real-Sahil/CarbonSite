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

  // QuickBooks SDK integration is not yet implemented.
  // When the SDK is ready: refresh token, query invoices, deduplicate, insert,
  // log sync entries, and enqueue anomaly detection.
  console.log(`[QB Sync] SDK not yet integrated for org ${organizationId}; skipping.`);
  return { created: 0, updated: 0, skipped: 0 };
}
