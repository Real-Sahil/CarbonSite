// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  site: { findMany: vi.fn() },
  svCommitment: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { parseSliceFilter, resolveSliceRefs, sliceWhere, socialValueBeside } from "@/lib/dashboard/slice-filter";

beforeEach(() => {
  db.site.findMany.mockReset();
  db.svCommitment.findMany.mockReset();
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
});
