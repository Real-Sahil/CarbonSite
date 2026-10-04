import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { parseSliceFilter, sliceWhere, summariseSlices } from "../slice-filter";
import { buildFlows } from "@/lib/charts/sankey";
import { selectionFor } from "@/components/charts/kit/sankey-chart";
import { stepCategory } from "@/components/charts/kit/waterfall-chart";

type Row = { scope: number; scope2Method: string | null; emissionCategoryId: string; facilityId: string | null; supplierKey: string | null; totalCo2e: number; recordCount: number };
const ROWS: Row[] = [
  { scope: 1, scope2Method: null, emissionCategoryId: "c1", facilityId: "f1", supplierKey: "calor", totalCo2e: 100, recordCount: 2 },
  { scope: 1, scope2Method: null, emissionCategoryId: "c1", facilityId: "f2", supplierKey: "certas", totalCo2e: 50, recordCount: 1 },
  { scope: 2, scope2Method: "location_based", emissionCategoryId: "c2", facilityId: "f1", supplierKey: "octopus", totalCo2e: 70, recordCount: 1 },
  { scope: 2, scope2Method: "market_based", emissionCategoryId: "c2", facilityId: "f1", supplierKey: "octopus", totalCo2e: 30, recordCount: 1 },
  { scope: 3, scope2Method: null, emissionCategoryId: "c3", facilityId: null, supplierKey: "biffa", totalCo2e: 25, recordCount: 1 },
];

// A tiny evaluator for the where fragments sliceWhere builds, over plain rows.
function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, c]) => {
    if (k === "OR") return (c as Record<string, unknown>[]).some((w) => matches(row, w));
    if (["organizationId", "reportingPeriodId", "snapshotId", "month"].includes(k)) return true;
    const v = row[k] ?? null;
    if (c !== null && typeof c === "object") {
      const o = c as { in?: unknown[]; contains?: string };
      if (o.in) return o.in.includes(v);
      if (o.contains !== undefined) return typeof v === "string" && v.includes(o.contains);
    }
    return v === c;
  });
}
const filtered = (raw: Parameters<typeof parseSliceFilter>[0], facilityIds: string[] | null = null) =>
  ROWS.filter((r) => matches(r, sliceWhere("o", "p", parseSliceFilter(raw) ?? {}, facilityIds)));

describe("cross-filtering by chart click", () => {
  it("every panel's total is the same for the same filters", () => {
    for (const raw of [{ scope: "1" }, { categoryId: "c1" }, { facilityId: "f1" }, { categoryId: "c1", facilityId: "f2" }]) {
      const rows = filtered(raw).map((r) => ({ ...r, totalCo2e: r.totalCo2e }));
      const { scopes, categories, facilities } = summariseSlices(rows);
      const headline = [...scopes.values()].reduce((t, v) => t + v.totalCo2e, 0);
      const byCategory = [...categories.values()].reduce((t, v) => t + v.totalCo2e, 0);
      const flows = buildFlows(rows, { category: (i) => i, facility: (i) => i });
      expect(byCategory).toBeCloseTo(headline);
      expect(flows.totalKg).toBeCloseTo(headline);
      const facilityTotal = [...facilities.values()].reduce((t, v) => t + v.totalCo2e, 0);
      expect(facilityTotal).toBeLessThanOrEqual(headline + 1e-9);
    }
  });

  it("filters to what was clicked (primary Scope 2 method only)", () => {
    expect(filtered({ scope: "1" }).map((r) => r.totalCo2e)).toEqual([100, 50]);
    expect(filtered({ categoryId: "c2" }).map((r) => r.totalCo2e)).toEqual([70]);
    expect(filtered({ facilityId: "f1" }).map((r) => r.totalCo2e)).toEqual([100, 70]);
  });

  it("a chosen facility narrows inside the entity, country or contract scope, never beyond it", () => {
    expect(filtered({ facilityId: "f1" }, ["f2"])).toEqual([]);
    expect(filtered({ facilityId: "f2" }, ["f1", "f2"]).map((r) => r.totalCo2e)).toEqual([50]);
    expect(filtered({}, ["f2"]).map((r) => r.totalCo2e)).toEqual([50]);
  });

  it("drops ids that are not plain ids", () => {
    expect(parseSliceFilter({ categoryId: "a b;--", facilityId: "x/../y" })).toBeNull();
  });
});

describe("what a click selects", () => {
  it("maps scope, category and real site nodes, and nothing for grouped nodes", () => {
    expect(selectionFor({ id: "scope:2", kind: "scope" })).toEqual({ key: "scope", value: "2" });
    expect(selectionFor({ id: "category:abc", kind: "category" })).toEqual({ key: "categoryId", value: "abc" });
    expect(selectionFor({ id: "site:f1", kind: "site" })).toEqual({ key: "facilityId", value: "f1" });
    expect(selectionFor({ id: "category:other:3", kind: "category" })).toBeNull();
    expect(selectionFor({ id: "site:other", kind: "site" })).toBeNull();
    expect(selectionFor({ id: "site:none", kind: "site" })).toBeNull();
  });

  it("a waterfall bar selects a category only for a real category step", () => {
    expect(stepCategory({ id: "c9", kind: "change" })).toBe("c9");
    expect(stepCategory({ id: "other", kind: "change" })).toBeNull();
    expect(stepCategory({ id: "start", kind: "total" })).toBeNull();
  });
});
