import { describe, expect, it } from "vitest";
import { PPN026_OUTCOMES, ppn026Checks, ppn026MinimumWeighting, summariseKpi, summarisePpn026, type KpiInput } from "../ppn026";

const kpi = (over: Partial<KpiInput> = {}): KpiInput => ({
  id: "k",
  title: "Apprenticeship starts",
  outcomeCode: "training",
  targetValue: 10,
  targetUnit: "starts",
  status: "active",
  activities: [],
  ...over,
});

describe("PPN 026 model", () => {
  it("has two outcomes and six award criteria", () => {
    expect(PPN026_OUTCOMES.map((o) => o.name)).toEqual(["Good Jobs", "Skills"]);
    expect(PPN026_OUTCOMES.flatMap((o) => o.criteria.map((c) => c.code))).toEqual(["jobs", "conditions", "pay", "training", "progression", "pipeline"]);
  });

  it("sets the minimum weighting by contract value", () => {
    expect(ppn026MinimumWeighting(null)).toBeNull();
    expect(ppn026MinimumWeighting(999_999)).toBeNull();
    expect(ppn026MinimumWeighting(1_000_000)).toBe(10);
    expect(ppn026MinimumWeighting(4_999_999)).toBe(10);
    expect(ppn026MinimumWeighting(5_000_000)).toBe(20);
  });
});

describe("KPI delivery", () => {
  it("counts only approved entries in the KPI's unit", () => {
    const s = summariseKpi(
      kpi({
        activities: [
          { status: "approved", quantityValue: 4, quantityUnit: "starts", evidenceCount: 1 },
          { status: "approved", quantityValue: 2, quantityUnit: "Starts ", evidenceCount: 0 },
          { status: "approved", quantityValue: 100, quantityUnit: "hours", evidenceCount: 1 },
          { status: "submitted", quantityValue: 5, quantityUnit: "starts", evidenceCount: 1 },
          { status: "rejected", quantityValue: 9, quantityUnit: "starts", evidenceCount: 1 },
        ],
      }),
    );
    expect(s).toMatchObject({ delivered: 6, progressPct: 60, approvedEntries: 3, pendingEntries: 1, entriesWithEvidence: 2 });
  });

  it("lists every criterion in model order and leaves cancelled KPIs out", () => {
    const out = summarisePpn026([kpi(), kpi({ id: "x", status: "cancelled" }), kpi({ id: "p", outcomeCode: "pay", title: "Real Living Wage" })]);
    expect(out.map((c) => c.code)).toEqual(["jobs", "conditions", "pay", "training", "progression", "pipeline"]);
    expect(out.find((c) => c.code === "training")!.kpis.map((k) => k.id)).toEqual(["k"]);
    expect(out.find((c) => c.code === "pay")!.kpis[0].title).toBe("Real Living Wage");
  });
});

describe("PPN 026 checks", () => {
  const failing = (value: number | null, kpis: KpiInput[]) => ppn026Checks(value, summarisePpn026(kpis)).filter((c) => !c.passed).map((c) => c.id);

  it("needs three KPIs on contracts of £5m or more, one below", () => {
    expect(failing(6_000_000, [kpi(), kpi({ id: "b" })])).toContain("kpi-count");
    expect(failing(6_000_000, [kpi(), kpi({ id: "b" }), kpi({ id: "c" })])).not.toContain("kpi-count");
    expect(failing(2_000_000, [kpi()])).not.toContain("kpi-count");
    expect(failing(2_000_000, [])).toEqual(expect.arrayContaining(["kpi-count", "targets"]));
  });

  it("needs a target and unit on each KPI and evidence on approved entries", () => {
    expect(failing(2_000_000, [kpi({ targetUnit: null })])).toContain("targets");
    expect(
      failing(2_000_000, [kpi({ activities: [{ status: "approved", quantityValue: 1, quantityUnit: "starts", evidenceCount: 0 }] })]),
    ).toContain("evidence");
  });
});
