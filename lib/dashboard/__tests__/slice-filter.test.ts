import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { parseSliceFilter, sliceWhere, summariseSlices } from "../slice-filter";

describe("parseSliceFilter", () => {
  it("is null when nothing usable is set", () => {
    expect(parseSliceFilter({})).toBeNull();
    expect(parseSliceFilter({ supplier: "  ", from: "March", to: "2026-13", scope: "4" })).toBeNull();
  });

  it("normalises the supplier like the slice writer and reads months and scope", () => {
    const f = parseSliceFilter({ supplier: "Certas Energy Ltd", from: "2026-03", to: "2026-05", scope: "3" })!;
    expect(f.supplierKey).toBe("certas energy");
    expect(f.from).toEqual(new Date(Date.UTC(2026, 2, 1)));
    expect(f.to).toEqual(new Date(Date.UTC(2026, 4, 1)));
    expect(f.scope).toBe(3);
  });
});

describe("sliceWhere", () => {
  it("always stays inside the organisation, period and live slices", () => {
    const w = sliceWhere("org1", "p1", { scope: 1 }, null);
    expect(w).toMatchObject({ organizationId: "org1", reportingPeriodId: "p1", snapshotId: null, scope: 1 });
    expect(w).not.toHaveProperty("facilityId");
  });

  it("adds facility scope, supplier and month range", () => {
    const from = new Date(Date.UTC(2026, 0, 1));
    const w = sliceWhere("org1", "p1", { supplierKey: "cert", from }, ["f1"]);
    expect(w).toMatchObject({ facilityId: { in: ["f1"] }, supplierKey: { contains: "cert" }, month: { gte: from } });
  });
});

describe("sliceWhere for the trend", () => {
  it("reads every period of the organisation when no period is named, still live and never beyond the organisation", () => {
    const w = sliceWhere("org1", null, { scope: 2 }, null);
    expect(w).toMatchObject({ organizationId: "org1", snapshotId: null, scope: 2 });
    expect(w).not.toHaveProperty("reportingPeriodId");
  });
});

describe("summariseSlices", () => {
  it("sums each calculation once per scope, category and facility", () => {
    const { scopes, categories, facilities } = summariseSlices([
      { scope: 1, emissionCategoryId: "c1", facilityId: "f1", totalCo2e: "10", recordCount: 1 },
      { scope: 1, emissionCategoryId: "c1", facilityId: "f2", totalCo2e: 5, recordCount: 2 },
      { scope: 2, emissionCategoryId: "c2", facilityId: "f1", totalCo2e: 20, recordCount: 1 },
      { scope: 3, emissionCategoryId: "c3", facilityId: null, totalCo2e: 7, recordCount: 1 },
    ]);
    expect(scopes.get(1)).toEqual({ totalCo2e: 15, recordCount: 3 });
    expect(categories.get("c1")).toEqual({ scope: 1, totalCo2e: 15, recordCount: 3 });
    expect(facilities.get("f1")).toEqual({ totalCo2e: 30, recordCount: 2 });
    expect([...facilities.keys()]).toEqual(["f1", "f2"]);
    expect([...scopes.values()].reduce((a, v) => a + v.totalCo2e, 0)).toBe(42);
  });
});
