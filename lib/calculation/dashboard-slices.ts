import type { Scope2Method } from "@prisma/client";
import { supplierKey } from "@/lib/social-value/local-spend";
import { reportingRows, type DashboardCalcInput } from "./dashboard-groups";

export type DashboardSliceKey = {
  scope: number;
  scope2Method: Scope2Method | null;
  emissionCategoryId: string;
  facilityId: string | null;
  siteId: string | null;
  contractId: string | null;
  supplierKey: string | null;
  month: Date | null;
};

export type DashboardSlice = { key: DashboardSliceKey; totalCo2e: number; count: number };

export type SliceCalcInput = Omit<DashboardCalcInput, "activityRecord"> & {
  activityRecord: DashboardCalcInput["activityRecord"] & {
    siteId: string | null;
    contractId: string | null;
    supplierName: string | null;
    activityDate: Date | null;
    startDate: Date | null;
  };
};

/** First day of the record's month in UTC, or null when it has no date. */
export function monthOf(record: { activityDate: Date | null; startDate: Date | null }): Date | null {
  const d = record.activityDate ?? record.startDate;
  return d ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)) : null;
}

/**
 * The DashboardSlice rows for one calculation run: exactly one row per distinct
 * combination of the key's fields, never a rollup. Summing any subset of
 * dimensions therefore counts each calculation once. Scope 2 follows the same
 * method rule as the aggregates (purchased heat sits under both methods when
 * the run has market-based electricity), so readers pin the method the same way.
 */
export function groupDashboardSlices(calculations: SliceCalcInput[]): DashboardSlice[] {
  const groups = new Map<string, DashboardSlice>();
  for (const { calc, scope2Method } of reportingRows(calculations)) {
    const r = calc.activityRecord;
    const key: DashboardSliceKey = {
      scope: r.emissionCategory.scope,
      scope2Method,
      emissionCategoryId: r.emissionCategoryId,
      facilityId: r.facilityId,
      siteId: r.siteId,
      contractId: r.contractId,
      supplierKey: (r.supplierName && supplierKey(r.supplierName)) || null,
      month: monthOf(r),
    };
    const k = JSON.stringify(key);
    const co2e = Number(calc.totalCo2e);
    const existing = groups.get(k);
    if (existing) {
      existing.totalCo2e += co2e;
      existing.count += 1;
    } else {
      groups.set(k, { key, totalCo2e: co2e, count: 1 });
    }
  }
  return [...groups.values()];
}
