import { prisma } from "@/lib/db";

/** One supplier in the latest calculation: spend and headline emissions, with both ranks. */
export type SupplierPriorityRow = {
  supplierKey: string;
  supplierName: string;
  spendAmount: number;
  spendCurrency: string;
  spendRecordCount: number;
  unconvertedSpendRecordCount: number;
  totalCo2eKg: number;
  recordCount: number;
  spendRank: number | null;
  emissionsRank: number | null;
};

export type SupplierPriorityView = {
  reportingPeriodLabel: string;
  calculationRunId: string;
  calculatedAt: Date;
  rows: SupplierPriorityRow[];
};

/**
 * Supplier priorities for the organisation's latest reporting period, read from
 * its latest successful calculation run: the same run the dashboard's live
 * totals use. Null when there is no period or no successful run yet. A run made
 * before supplier priorities existed has no rows.
 */
export async function loadSupplierPriorities(organizationId: string): Promise<SupplierPriorityView | null> {
  const period = await prisma.reportingPeriod.findFirst({
    where: { organizationId },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, label: true },
  });
  if (!period) return null;

  const run = await prisma.calculationRun.findFirst({
    where: { organizationId, reportingPeriodId: period.id, status: "succeeded" },
    orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, finishedAt: true, createdAt: true },
  });
  if (!run) return null;

  const rows = await prisma.supplierPriority.findMany({
    where: { organizationId, calculationRunId: run.id },
    orderBy: [
      { spendRank: { sort: "asc", nulls: "last" } },
      { emissionsRank: { sort: "asc", nulls: "last" } },
      { supplierName: "asc" },
    ],
    select: {
      supplierKey: true,
      supplierName: true,
      spendAmount: true,
      spendCurrency: true,
      spendRecordCount: true,
      unconvertedSpendRecordCount: true,
      totalCo2eKg: true,
      recordCount: true,
      spendRank: true,
      emissionsRank: true,
    },
  });

  return {
    reportingPeriodLabel: period.label,
    calculationRunId: run.id,
    calculatedAt: run.finishedAt ?? run.createdAt,
    rows: rows.map((r) => ({
      ...r,
      spendAmount: Number(r.spendAmount),
      totalCo2eKg: Number(r.totalCo2eKg),
    })),
  };
}
