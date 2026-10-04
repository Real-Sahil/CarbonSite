import type { Scope2Method } from "@prisma/client";
import { inBothScope2Totals, scope2MethodOf } from "./scope2-method";

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
 * The (calculation, Scope 2 method) pairs a run is written under: each
 * calculation once under its own method, and purchased heat a second time under
 * market-based when the run has market-based electricity (inBothScope2Totals).
 * Shared with the slice table so both rebuild from the same rule.
 */
export function reportingRows<T extends DashboardCalcInput>(
  calculations: T[],
): Array<{ calc: T; scope2Method: Scope2Method | null }> {
  const hasMarket = calculations.some((c) => scope2MethodOf(c.activityRecord) === "market_based");
  const rows: Array<{ calc: T; scope2Method: Scope2Method | null }> = [];
  for (const calc of calculations) {
    rows.push({ calc, scope2Method: scope2MethodOf(calc.activityRecord) });
    if (hasMarket && inBothScope2Totals(calc.activityRecord)) rows.push({ calc, scope2Method: "market_based" });
  }
  return rows;
}

/**
 * The DashboardAggregate rows for one calculation run. Each calculation is
 * written into several rows, one per breakdown dimension:
 *   - a scope rollup row       (category, facility and business unit null)
 *   - a per-category row
 *   - a per-facility row and a category-by-facility row, when it has a facility
 *   - a per-business-unit row, when it has one
 * Scope 2 rows are split by reporting method; purchased heat is written under
 * both methods when the run has market-based electricity (inBothScope2Totals).
 * Readers pin dimensions through
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

  const rows = reportingRows(calculations);

  for (const { calc, scope2Method } of rows) {
    const record = calc.activityRecord;
    const scope = record.emissionCategory.scope;
    const co2e = Number(calc.totalCo2e);
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
