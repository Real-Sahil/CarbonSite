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

  // Sage SDK integration is not yet implemented.
  // When the SDK is ready: refresh token, query invoices, deduplicate, insert,
  // log sync entries, and enqueue anomaly detection.
  console.log(`[Sage Sync] SDK not yet integrated for org ${organizationId}; skipping.`);
  return { created: 0, updated: 0, skipped: 0 };
}
