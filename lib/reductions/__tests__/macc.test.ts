import { describe, it, expect } from "vitest";
import { computeMacc, buildMaccCurve } from "../macc";

describe("computeMacc", () => {
  it("excludes initiatives with no positive abatement", () => {
    const entries = computeMacc([
      { id: "1", name: "No impact", capexAmount: 1000, opexDeltaAnnual: 0, lifetimeYears: 10, expectedImpactCo2e: 0 },
      { id: "2", name: "Null impact", capexAmount: 1000, opexDeltaAnnual: 0, lifetimeYears: 10, expectedImpactCo2e: null },
    ]);
    expect(entries).toHaveLength(0);
  });

  it("annualises capex straight-line over the lifetime", () => {
    const [entry] = computeMacc([
      { id: "1", name: "LED retrofit", capexAmount: 10000, opexDeltaAnnual: 0, lifetimeYears: 10, expectedImpactCo2e: 100 },
    ]);
    expect(entry.annualizedCapex).toBeCloseTo(1000);
    expect(entry.marginalCostPerTco2e).toBeCloseTo(10);
  });

  it("treats capex as a single year's cost when no lifetime is given", () => {
    const [entry] = computeMacc([
      { id: "1", name: "One-off", capexAmount: 5000, opexDeltaAnnual: 0, lifetimeYears: null, expectedImpactCo2e: 100 },
    ]);
    expect(entry.annualizedCapex).toBe(5000);
    expect(entry.marginalCostPerTco2e).toBeCloseTo(50);
  });

  it("produces a negative marginal cost for a win-win measure that saves more than it costs", () => {
    const [entry] = computeMacc([
      {
        id: "1",
        name: "LED lighting (self-funding)",
        capexAmount: 10000,
        opexDeltaAnnual: -2000, // saves 2000/year in energy costs
        lifetimeYears: 10,
        expectedImpactCo2e: 50,
      },
    ]);
    // annualizedCapex 1000, totalAnnualCost = 1000 - 2000 = -1000, /50 = -20
    expect(entry.marginalCostPerTco2e).toBeCloseTo(-20);
    expect(entry.marginalCostPerTco2e).toBeLessThan(0);
  });

  it("computes a simple payback period for a measure with net annual savings", () => {
    const [entry] = computeMacc([
      { id: "1", name: "Solar PV", capexAmount: 20000, opexDeltaAnnual: -4000, lifetimeYears: 25, expectedImpactCo2e: 30 },
    ]);
    expect(entry.paybackYears).toBeCloseTo(5);
  });

  it("returns a null payback for a measure with no net annual savings", () => {
    const [entry] = computeMacc([
      { id: "1", name: "Costly retrofit", capexAmount: 20000, opexDeltaAnnual: 500, lifetimeYears: 10, expectedImpactCo2e: 30 },
    ]);
    expect(entry.paybackYears).toBeNull();
  });

  it("sorts cheapest measures first, including negative-cost ones", () => {
    const entries = computeMacc([
      { id: "expensive", name: "Expensive", capexAmount: 100000, opexDeltaAnnual: 0, lifetimeYears: 10, expectedImpactCo2e: 10 },
      { id: "cheap", name: "Cheap", capexAmount: 1000, opexDeltaAnnual: 0, lifetimeYears: 10, expectedImpactCo2e: 10 },
      { id: "winwin", name: "Win-win", capexAmount: 1000, opexDeltaAnnual: -5000, lifetimeYears: 10, expectedImpactCo2e: 10 },
    ]);
    expect(entries.map((e) => e.id)).toEqual(["winwin", "cheap", "expensive"]);
  });
});

describe("buildMaccCurve", () => {
  it("accumulates abatement across entries in order", () => {
    const entries = computeMacc([
      { id: "a", name: "A", capexAmount: 0, opexDeltaAnnual: 100, lifetimeYears: 1, expectedImpactCo2e: 10 },
      { id: "b", name: "B", capexAmount: 0, opexDeltaAnnual: 200, lifetimeYears: 1, expectedImpactCo2e: 20 },
    ]);
    const curve = buildMaccCurve(entries);
    expect(curve[0].cumulativeAbatementStartTco2e).toBe(0);
    expect(curve[0].cumulativeAbatementEndTco2e).toBe(10);
    expect(curve[1].cumulativeAbatementStartTco2e).toBe(10);
    expect(curve[1].cumulativeAbatementEndTco2e).toBe(30);
  });
});
