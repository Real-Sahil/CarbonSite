// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const model = () => ({ findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() });
  return {
    carbonReductionPlan: model(),
    transitionPlan: model(),
    baseYear: model(),
    reductionInitiative: model(),
    internalCarbonPrice: model(),
  };
});
vi.mock("@/lib/db", () => ({ prisma: db }));

import { loadOrgCommitments } from "../commitments";
import { renderGhgProtocolHtml } from "../templates/ghg-protocol";

const period = { id: "p25", endDate: new Date("2025-12-31T00:00:00Z") };

const plan = {
  targets: { netZeroYear: 2045, interim: [{ id: "a", year: 2030, reductionPct: 50, scopes: "s1s2" }] },
  measures: {
    completed: [{ id: "m1", name: "HVO in plant", year: 2025, description: "", savingTco2e: 180 }],
    planned: [{ id: "m2", name: "Battery plant", year: 2027, description: "", savingTco2e: 0 }],
  },
  secr: { efficiencyNarrative: "HVO replaced diesel\n- LED lighting at the depot\n" },
  declaration: { signatoryName: "Sam Hartley", signatoryTitle: "Managing Director", signedDate: "2026-09-25" },
};

beforeEach(() => {
  vi.clearAllMocks();
  db.carbonReductionPlan.findFirst.mockResolvedValue(null);
  db.transitionPlan.findUnique.mockResolvedValue(null);
  db.baseYear.findFirst.mockResolvedValue(null);
  db.reductionInitiative.findMany.mockResolvedValue([]);
  db.internalCarbonPrice.findMany.mockResolvedValue([]);
});

describe("loadOrgCommitments", () => {
  it("records nothing the organisation has not recorded", async () => {
    const c = await loadOrgCommitments("org-a", period);
    expect(c).toMatchObject({ baseYear: null, netZeroYear: null, interimTargets: [], signatory: null, carbonPrice: null });
  });

  it("reads the period's Carbon Reduction Plan before the transition plan", async () => {
    db.carbonReductionPlan.findFirst.mockResolvedValue({ sections: plan });
    db.transitionPlan.findUnique.mockResolvedValue({ netZeroYear: 2040 });
    const c = await loadOrgCommitments("org-a", period);
    expect(c.netZeroYear).toBe(2045);
    expect(c.interimTargets).toEqual([{ year: 2030, reductionPct: 50, description: "Scopes 1 and 2" }]);
    expect(c.signatory).toEqual({ name: "Sam Hartley", title: "Managing Director", date: "2026-09-25" });
    expect(c.efficiencyMeasures).toEqual(["HVO replaced diesel", "LED lighting at the depot"]);
    // A saving of 0 was not estimated.
    expect(c.plannedMeasures).toEqual([{ name: "Battery plant", year: 2027, savingTco2e: null }]);
    // Every query is scoped to the organisation.
    for (const call of db.carbonReductionPlan.findFirst.mock.calls) expect(call[0].where.organizationId).toBe("org-a");
    expect(db.baseYear.findFirst.mock.calls[0][0].where.organizationId).toBe("org-a");
  });

  it("falls back to the transition plan's net zero year", async () => {
    db.transitionPlan.findUnique.mockResolvedValue({ netZeroYear: 2040 });
    expect((await loadOrgCommitments("org-a", period)).netZeroYear).toBe(2040);
  });

  it("adds reduction initiatives once, in tonnes", async () => {
    db.carbonReductionPlan.findFirst.mockResolvedValue({ sections: plan });
    db.reductionInitiative.findMany.mockResolvedValue([
      { name: "hvo in plant", status: "complete", expectedImpactCo2e: 5000, expectedStartDate: null },
      { name: "Solar at depot", status: "in_progress", expectedImpactCo2e: 12000, expectedStartDate: new Date("2026-04-01") },
    ]);
    const c = await loadOrgCommitments("org-a", period);
    expect(c.completedMeasures.map((m) => m.name)).toEqual(["HVO in plant"]);
    expect(c.plannedMeasures).toContainEqual({ name: "Solar at depot", year: 2026, savingTco2e: 12 });
  });

  it("uses the active base year's current totals", async () => {
    db.baseYear.findFirst.mockResolvedValue({
      label: "FY2024 base year",
      reportingPeriod: { endDate: new Date("2024-12-31") },
      originalScope1Co2e: 1000, originalScope2Co2e: 170, originalScope3Co2e: 4000, originalTotalCo2e: 5170,
      currentScope1Co2e: 1009.1, currentScope2Co2e: 171.8, currentScope3Co2e: 4184, currentTotalCo2e: 5364.9,
    });
    const c = await loadOrgCommitments("org-a", period);
    expect(c.baseYear).toEqual({ label: "FY2024 base year", year: 2024, s1: 1009.1, s2: 171.8, s3: 4184, total: 5364.9 });
  });
});

describe("GHG Protocol Scope 3 completeness note", () => {
  it("lists only the categories with no data", () => {
    const html = renderGhgProtocolHtml({
      orgName: "Acme", periodLabel: "FY2025", periodStart: new Date("2025-01-01"), periodEnd: new Date("2025-12-31"),
      snapshotVersion: 1, publishedAt: new Date("2026-01-10"), publishedBy: "Sam", factorLibrary: "DEFRA 2025.2",
      methodology: "ghg-protocol-v2026-02", gwpVersion: "AR6", scope1Kg: 1000, scope2LocationKg: 500, scope2MarketKg: 0,
      scope3Kg: 3000, totalKg: 4500, recordCount: 3,
      categories: [
        { code: "s1-mobile", name: "Mobile Combustion", scope: 1, totalKg: 1000 },
        { code: "s3-purchased-goods", name: "Purchased Goods & Services", scope: 3, totalKg: 2000 },
        { code: "s3-business-travel", name: "Business Travel", scope: 3, totalKg: 1000 },
      ],
    });
    const note = html.slice(html.indexOf("Not reported in this inventory"));
    expect(note).toContain("2. Capital goods");
    expect(note).not.toContain("1. Purchased goods");
    expect(note).not.toContain("6. Business travel");
    // No gas split in the data, so no empty per-gas columns.
    expect(html).not.toContain("CH₄ (tCO₂e)");
  });
});
