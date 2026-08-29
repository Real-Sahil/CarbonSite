import { reportLogger } from "@/lib/logger";

/**
 * Syncs invoices from Xero and creates/updates activity records
 * TODO: Implement when XeroIntegration model is added to schema
 */
export async function syncXeroInvoices(orgId: string): Promise<void> {
  reportLogger.info("Skipping Xero sync - XeroIntegration model not yet implemented", { orgId });
}

