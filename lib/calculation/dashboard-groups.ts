import type { Scope2Method } from "@prisma/client";
import { scope2MethodOf } from "./scope2-method";

export type DashboardGroupKey = {
  scope: number;
  scope2Method: Scope2Method | null;
  emissionCategoryId: string | null;
  facilityId: string | null;
  businessUnitId: string | null;
};

export type DashboardGroup = { key: DashboardGroupKey; totalCo2e: number; count: number };

export type DashboardCalcInput = {
  totalCo2e: number | string | { toString(): string };
  activityRecord: {
    emissionCategoryId: string;
    facilityId: string | null;
    businessUnitId: string | null;
    scope2Method?: Scope2Method | null;
    emissionCategory: { scope: number; code?: string | null };
  };
};

/**
 * The DashboardAggregate rows for one calculation run. Each calculation is
 * written into several rows, one per breakdown dimension:
 *   - a scope rollup row       (category, facility and business unit null)
 *   - a per-category row
 *   - a per-facility row and a category-by-facility row, when it has a facility
 *   - a per-business-unit row, when it has one
 * Scope 2 rows are split by reporting method. Readers pin dimensions through
 * lib/calculation/aggregate-filters.ts so nothing is summed twice.
 */
export function groupDashboardAggregates(calculations: DashboardCalcInput[]): DashboardGroup[] {
  const groups = new Map<string, DashboardGroup>();
  const add = (key: DashboardGroupKey, co2e: number) => {
    const k = JSON.stringify(key);
    const existing = groups.get(k);
    if (existing) {
      existing.totalCo2e += co2e;
      existing.count += 1;
    } else {
      groups.set(k, { key, totalCo2e: co2e, count: 1 });
    }
  };

  for (const calc of calculations) {
    const record = calc.activityRecord;
    const scope = record.emissionCategory.scope;
    const co2e = Number(calc.totalCo2e);
    const scope2Method = scope2MethodOf(record);
    const base = { scope, scope2Method };

    add({ ...base, emissionCategoryId: null, facilityId: null, businessUnitId: null }, co2e);
    add({ ...base, emissionCategoryId: record.emissionCategoryId, facilityId: null, businessUnitId: null }, co2e);
    if (record.facilityId) {
      add({ ...base, emissionCategoryId: null, facilityId: record.facilityId, businessUnitId: null }, co2e);
      // Category by facility, so a category breakdown can be scoped to a
      // contract's facilities without exceeding the contract total.
      add({ ...base, emissionCategoryId: record.emissionCategoryId, facilityId: record.facilityId, businessUnitId: null }, co2e);
    }
    if (record.businessUnitId) {
      add({ ...base, emissionCategoryId: null, facilityId: null, businessUnitId: record.businessUnitId }, co2e);
    }
  }
  return [...groups.values()];
}
