// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  site: { findMany: vi.fn() },
  svCommitment: { findMany: vi.fn() },
  dashboardSlice: { groupBy: vi.fn() },
  reportingPeriod: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { loadSliceScopes, loadSliceTrend, parseSliceFilter, resolveSliceRefs, sliceWhere, socialValueBeside } from "@/lib/dashboard/slice-filter";

beforeEach(() => {
  db.site.findMany.mockReset();
  db.svCommitment.findMany.mockReset();
  db.dashboardSlice.groupBy.mockReset();
  db.reportingPeriod.findMany.mockReset();
});

describe("dashboard project and social value filters stay inside the organisation", () => {
  it("looks a project's sites up with the organisation in the where, so another organisation's project has none", async () => {
    db.site.findMany.mockResolvedValue([]);
    const refs = await resolveSliceRefs("org1", parseSliceFilter({ projectId: "otherOrgProject" })!);
    expect(db.site.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org1", projectId: "otherOrgProject" } }));
    expect(refs.siteIds).toEqual([]);
    // An empty site list reaches the slice where as `in: []`: no rows, never everything.
    expect(sliceWhere("org1", "p1", { projectId: "x" }, null, refs)).toMatchObject({ organizationId: "org1", siteId: { in: [] } });
  });

  it("reads social value contracts inside the organisation and leaves cancelled commitments out", async () => {
    db.svCommitment.findMany.mockResolvedValue([{ contractId: "k1" }]);
    const refs = await resolveSliceRefs("org1", { socialValue: true });
    expect(db.svCommitment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org1", contractId: { not: null }, status: { not: "cancelled" } } }),
    );
    expect(refs.contractIds).toEqual(["k1"]);
    expect(sliceWhere("org1", "p1", { socialValue: true }, null, refs)).toMatchObject({ contractId: { in: ["k1"] } });
  });

  it("sums social value in GBP only and counts other currencies apart", async () => {
    db.svCommitment.findMany.mockResolvedValue([
      { monetisedValue: "1000", currency: "GBP" },
      { monetisedValue: "500.5", currency: "GBP" },
      { monetisedValue: "900", currency: "EUR" },
      { monetisedValue: null, currency: "GBP" },
    ]);
    const s = await socialValueBeside("org1", ["k1", "k2"]);
    expect(db.svCommitment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org1" }) }));
    expect(s).toEqual({ contracts: 2, commitments: 4, gbpValue: 1500.5, otherCurrency: 1 });
  });

  it("drops a project id that is not a plain id and an sv value other than 1", () => {
    expect(parseSliceFilter({ projectId: "a b;--", sv: "yes" })).toBeNull();
    expect(parseSliceFilter({ projectId: "cm123", sv: "1" })).toEqual({ projectId: "cm123", socialValue: true });
  });

  it("the trend and the year-on-year scopes read slices and periods inside the organisation", async () => {
    db.site.findMany.mockResolvedValue([{ id: "s1" }]);
    db.dashboardSlice.groupBy.mockResolvedValue([{ reportingPeriodId: "p1", scope: 1, _sum: { totalCo2e: "10" } }, { reportingPeriodId: "pForeign", scope: 1, _sum: { totalCo2e: "99" } }]);
    db.reportingPeriod.findMany.mockResolvedValue([{ id: "p1", label: "FY2025", startDate: new Date("2025-01-01") }]);
    const trend = await loadSliceTrend("org1", { projectId: "x" }, null);
    expect(db.dashboardSlice.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org1", snapshotId: null, siteId: { in: ["s1"] } }) }));
    expect(db.reportingPeriod.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org1" }) }));
    // a period that is not the organisation's never reaches the chart
    expect(trend.map((t) => t.reportingPeriod.id)).toEqual(["p1"]);

    db.dashboardSlice.groupBy.mockResolvedValue([{ scope: 2, _sum: { totalCo2e: "5.5", recordCount: 2 } }]);
    const scopes = await loadSliceScopes("org1", "p0", { scope: 2 }, ["f1"]);
    expect(db.dashboardSlice.groupBy).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org1", reportingPeriodId: "p0", facilityId: { in: ["f1"] } }) }));
    expect(scopes).toEqual([{ scope: 2, _sum: { totalCo2e: "5.5", recordCount: 2 } }]);
  });
});
