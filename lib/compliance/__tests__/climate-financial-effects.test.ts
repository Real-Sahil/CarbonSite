import { describe, expect, it, vi } from "vitest";

const db = { tcfdRiskAssessment: { findMany: vi.fn() } };
const risk = (type: "physical" | "transition", low: number | null, high: number | null = null) => ({
  financialImpactLow: low, financialImpactHigh: high, scenario: { scenarioType: type },
});

async function run() {
  const { runResolver } = await import("@/lib/compliance/datapoint-resolvers");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return runResolver("climate_financial_effects", "org-a", db as any);
}

describe("E1-9 resolver", () => {
  it("is a gap with no risk assessments, and reads only the org's own", async () => {
    db.tcfdRiskAssessment.findMany.mockResolvedValue([]);
    expect((await run())?.status).toBe("gap");
    expect(db.tcfdRiskAssessment.findMany.mock.calls[0][0].where).toEqual({ organizationId: "org-a" });
  });

  it("is partial when only one kind of risk has a financial estimate, and says which is missing", async () => {
    db.tcfdRiskAssessment.findMany.mockResolvedValue([risk("physical", 1000, 5000), risk("transition", null)]);
    const r = await run();
    expect(r?.status).toBe("partial");
    expect(r?.evidenceSummary).toContain("No estimate yet for transition risk");
  });

  it("is satisfied when physical and transition risk both carry an estimate", async () => {
    db.tcfdRiskAssessment.findMany.mockResolvedValue([risk("physical", 1000), risk("transition", null, 9000)]);
    expect((await run())?.status).toBe("satisfied");
  });
});
