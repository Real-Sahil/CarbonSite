import type { Prisma } from "@prisma/client";

const CHUNK = 2000;

/**
 * Freezes a period's live DashboardSlice rows onto a published snapshot, the
 * same way its DashboardAggregate rows are copied, inside the caller's
 * transaction so a snapshot never exists with aggregates but no slices.
 */
export async function copyLiveSlicesToSnapshot(
  tx: Prisma.TransactionClient,
  organizationId: string,
  reportingPeriodId: string,
  snapshotId: string,
): Promise<void> {
  const live = await tx.dashboardSlice.findMany({
    where: { organizationId, reportingPeriodId, snapshotId: null },
    select: {
      scope: true,
      scope2Method: true,
      emissionCategoryId: true,
      facilityId: true,
      siteId: true,
      contractId: true,
      supplierKey: true,
      month: true,
      totalCo2e: true,
      recordCount: true,
    },
  });
  for (let i = 0; i < live.length; i += CHUNK) {
    await tx.dashboardSlice.createMany({
      data: live.slice(i, i + CHUNK).map((row) => ({
        ...row,
        organizationId,
        reportingPeriodId,
        snapshotId,
      })),
    });
  }
}
