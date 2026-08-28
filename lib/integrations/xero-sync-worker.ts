import { prisma } from "@/lib/db";
import { syncXeroBillsToActivityRecords } from "./xero";
import { writeAuditLog } from "@/lib/db/audit";

export async function processXeroSync(
  orgId: string,
  fromDate?: string
): Promise<void> {
  console.log(`[xero-sync] Starting sync for org ${orgId}`, {
    fromDate,
  });

  try {
    // Check if org exists and has Xero connected
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });

    if (!org) {
      console.error(`[xero-sync] Organization ${orgId} not found`);
      throw new Error(`Organization not found: ${orgId}`);
    }

    const connection = await prisma.integrationConnection.findUnique({
      where: { organizationId_provider: { organizationId: orgId, provider: "xero" } },
      select: { id: true, externalAccountName: true },
    });

    if (!connection) {
      console.warn(`[xero-sync] No Xero connection for org ${orgId}`);
      return;
    }

    // Perform the sync
    const fromDateObj = fromDate ? new Date(fromDate) : undefined;
    const result = await syncXeroBillsToActivityRecords(orgId, fromDateObj);

    console.log(`[xero-sync] Completed sync for org ${orgId}`, result);

    // Log the sync event
    await writeAuditLog({
      organizationId: orgId,
      action: "integration.connected",
      resourceType: "XeroSync",
      resourceId: connection.id,
      metadata: {
        provider: "xero",
        syncedRecords: result.synced,
        failedRecords: result.failed,
        fromDate: fromDate ?? null,
        completedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(`[xero-sync] Error syncing org ${orgId}:`, error);

    // Log the sync failure
    await writeAuditLog({
      organizationId: orgId,
      action: "integration.disconnected",
      resourceType: "XeroSync",
      resourceId: "unknown",
      metadata: {
        provider: "xero",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    }).catch((logError) => {
      console.error("[xero-sync] Failed to log sync error:", logError);
    });

    throw error;
  }
}
