// @vitest-environment node
/**
 * Core trust invariant: a report's totals match the dashboard's totals for the
 * same calculation run. Both paths are run on one set of calculations: the
 * dashboard through groupDashboardAggregates() read back with the real
 * filters from aggregate-filters.ts, the report through aggregate().
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/storage", () => ({ getObject: vi.fn() }));

import { groupDashboardAggregates, type DashboardGroup } from "../dashboard-groups";
import {
  CATEGORY_BREAKDOWN_DIMENSIONS,
  FACILITY_BREAKDOWN_DIMENSIONS,
  SCOPE_ROLLUP_DIMENSIONS,
} from "../aggregate-filters";
import { aggregate, splitScope2, type CalculationRow } from "@/lib/reports/aggregation";

type Where = Record<string, unknown>;

/** Evaluates the subset of Prisma where syntax the aggregate filters use. */
function matches(row: Record<string, unknown>, where: Where): boolean {
  return Object.entries(where).every(([field, cond]) => {
    if (field === "OR") return (cond as Where[]).some((w) => matches(row, w));
    const value = row[field] ?? null;
    if (cond !== null && typeof cond === "object") {
      const c = cond as { not?: unknown; in?: unknown[] };
      if ("not" in c) return value !== c.not;
      if ("in" in c) return c.in!.includes(value);
    }
    return value === cond;
  });
}

function sum(groups: DashboardGroup[], where: Where) {
  return groups.filter((g) => matches(g.key, where)).reduce((t, g) => t + g.totalCo2e, 0);
}

const CATEGORIES = {
  "s1-stationary": { id: "cat-s1", scope: 1, name: "Stationary combustion" },
  "s2-electricity-lb": { id: "cat-s2lb", scope: 2, name: "Electricity (location-based)" },
  "s2-electricity-mb": { id: "cat-s2mb", scope: 2, name: "Electricity (market-based)" },
  "s2-heat": { id: "cat-s2h", scope: 2, name: "Purchased heat" },
  "s3-waste": { id: "cat-s3w", scope: 3, name: "Waste" },
} as const;

let n = 0;
function calc(
  code: keyof typeof CATEGORIES,
  kg: number,
  opts: { facility?: string; bu?: string; scope2Method?: "location_based" | "market_based" } = {},
) {
  const cat = CATEGORIES[code];
  return {
    id: `calc-${++n}`,
    totalCo2e: kg,
    co2: null,
    ch4: null,
    n2o: null,
    biogenicCo2e: null,
    activityRecord: {
      emissionCategoryId: cat.id,
      facilityId: opts.facility ?? null,
      businessUnitId: opts.bu ?? null,
      scope2Method: opts.scope2Method ?? null,
      facility: opts.facility ? { name: opts.facility } : null,
      emissionCategory: { code, name: cat.name, scope: cat.scope },
    },
  };
}

const calcs = [
  calc("s1-stationary", 1200.5, { facility: "Depot", bu: "Civils" }),
  calc("s1-stationary", 300, { facility: "Yard" }),
  calc("s1-stationary", 45.25),
  // Dual-reported electricity: same meter, both methods.
  calc("s2-electricity-lb", 800, { facility: "Depot", bu: "Civils" }),
  calc("s2-electricity-mb", 150, { facility: "Depot", bu: "Civils" }),
  // Method on the record wins over the category.
  calc("s2-electricity-lb", 90, { facility: "Yard", scope2Method: "market_based" }),
  calc("s2-electricity-lb", 60, { facility: "Yard", scope2Method: "location_based" }),
  // District heating counts in both Scope 2 totals.
  calc("s2-heat", 40, { facility: "Depot" }),
  calc("s3-waste", 510.75, { facility: "Yard", bu: "Rail" }),
  calc("s3-waste", 20),
];

const groups = groupDashboardAggregates(calcs);
const report = aggregate(calcs as unknown as CalculationRow[]);
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe("report totals match dashboard totals for the same run", () => {
  it("grand total", () => {
    close(report.grandKg, sum(groups, { ...SCOPE_ROLLUP_DIMENSIONS, facilityId: null }));
  });

  it("each scope", () => {
    for (const scope of [1, 2, 3]) {
      close(report.scopeKg.get(scope) ?? 0, sum(groups, { ...SCOPE_ROLLUP_DIMENSIONS, facilityId: null, scope }));
    }
  });

  it("each category", () => {
    for (const cat of Object.values(CATEGORIES)) {
      const dash = sum(groups, { ...CATEGORY_BREAKDOWN_DIMENSIONS, emissionCategoryId: cat.id });
      close(report.catTotals.get(cat.name)?.totalKg ?? 0, dash);
    }
  });

  it("each facility", () => {
    for (const facility of ["Depot", "Yard"]) {
      close(report.facTotals.get(facility)?.totalKg ?? 0, sum(groups, { ...FACILITY_BREAKDOWN_DIMENSIONS, facilityId: facility }));
    }
  });

  it("both Scope 2 methods, reported side by side", () => {
    const { s2lbKg, s2mbKg } = splitScope2(calcs as unknown as CalculationRow[]);
    const methodTotal = (scope2Method: string) =>
      sum(groups, { emissionCategoryId: null, facilityId: null, businessUnitId: null, scope: 2, scope2Method });
    close(s2lbKg, methodTotal("location_based"));
    close(s2mbKg, methodTotal("market_based"));
    close(s2lbKg, 900);
    close(s2mbKg, 280);
  });

  it("market-based Scope 2 is never added to the headline", () => {
    close(report.grandKg, 1200.5 + 300 + 45.25 + 800 + 60 + 40 + 510.75 + 20);
  });

  it("leaves the market-based total empty when there is no market-based electricity, heat or not", () => {
    const heatOnly = [calc("s2-electricity-lb", 800), calc("s2-heat", 40)];
    const g = groupDashboardAggregates(heatOnly);
    expect(g.some((x) => x.key.scope2Method === "market_based")).toBe(false);
    expect(splitScope2(heatOnly as unknown as CalculationRow[])).toEqual({ s2lbKg: 840, s2mbKg: 0 });
  });
});
