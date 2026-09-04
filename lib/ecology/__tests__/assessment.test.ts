import { describe, it, expect } from "vitest";
import { computeParcelUnits, totalsFromParcels } from "../assessment";
import { baselineUnits, timeToTargetMultiplier } from "../biodiversity-metric";

describe("computeParcelUnits", () => {
  const base = {
    module: "area" as const,
    size: 2,
    distinctiveness: "medium" as const,
    condition: "moderate" as const,
    strategicSignificance: "low" as const,
    difficulty: "medium" as const,
    yearsToTargetCondition: 10,
    spatialRisk: "outside_neighbouring" as const,
  };

  it("values a baseline parcel on the four base terms alone", () => {
    // Risk multipliers describe delivery risk on promised habitat. Habitat
    // that already exists carries none of it.
    const result = computeParcelUnits({ ...base, stage: "baseline" });
    expect(result.units).toBeCloseTo(2 * 4 * 2 * 1.0, 10);
    expect(result.calculation).not.toContain("difficulty");
  });

  it("values retained habitat the same as baseline", () => {
    const retained = computeParcelUnits({ ...base, stage: "retained" });
    const asBaseline = computeParcelUnits({ ...base, stage: "baseline" });
    expect(retained.units).toBeCloseTo(asBaseline.units, 10);
  });

  it("applies the three risk multipliers to created habitat", () => {
    const result = computeParcelUnits({ ...base, stage: "created" });
    const expected = 2 * 4 * 2 * 1.0 * 0.67 * timeToTargetMultiplier(10) * 0.75;
    expect(result.units).toBeCloseTo(expected, 8);
    expect(result.calculation).toContain("difficulty");
    expect(result.calculation).toContain("spatial risk");
  });

  it("applies the same discounts to enhanced habitat", () => {
    const created = computeParcelUnits({ ...base, stage: "created" });
    const enhanced = computeParcelUnits({ ...base, stage: "enhanced" });
    expect(enhanced.units).toBeCloseTo(created.units, 10);
  });

  it("writes out arithmetic a planning officer can check by hand", () => {
    const result = computeParcelUnits({ ...base, stage: "created" });
    expect(result.calculation).toContain("2 ha");
    expect(result.calculation).toContain("4 distinctiveness");
    expect(result.calculation).toContain("2 condition");
    expect(result.calculation).toContain("10 years at 3.5%");
    expect(result.calculation).toContain(result.units.toFixed(4));
  });

  it("labels hedgerow and watercourse parcels in kilometres", () => {
    const hedge = computeParcelUnits({ ...base, stage: "baseline", module: "hedgerow" });
    expect(hedge.calculation).toContain("2 km");
    const river = computeParcelUnits({ ...base, stage: "baseline", module: "watercourse" });
    expect(river.calculation).toContain("2 km");
  });

  it("gives very low distinctiveness parcels no units in any stage", () => {
    for (const stage of ["baseline", "retained", "enhanced", "created"] as const) {
      const result = computeParcelUnits({ ...base, stage, distinctiveness: "very_low" });
      expect(result.units).toBe(0);
    }
  });

  it("clamps a negative size to zero", () => {
    const result = computeParcelUnits({ ...base, stage: "baseline", size: -5 });
    expect(result.units).toBe(0);
  });

  it("agrees with the metric primitives", () => {
    const result = computeParcelUnits({ ...base, stage: "baseline" });
    expect(result.units).toBeCloseTo(
      baselineUnits({
        size: base.size,
        distinctiveness: base.distinctiveness,
        condition: base.condition,
        strategicSignificance: base.strategicSignificance,
      }),
      10,
    );
  });
});

describe("totalsFromParcels", () => {
  it("splits baseline from post-intervention and keeps modules separate", () => {
    const totals = totalsFromParcels([
      { stage: "baseline", module: "area", units: 100 },
      { stage: "baseline", module: "hedgerow", units: 20 },
      { stage: "retained", module: "area", units: 40 },
      { stage: "created", module: "area", units: 75 },
      { stage: "enhanced", module: "hedgerow", units: 25 },
      { stage: "baseline", module: "watercourse", units: 5 },
    ] as never);

    expect(totals.area.baseline).toBe(100);
    expect(totals.area.postIntervention).toBe(115);
    expect(totals.hedgerow.baseline).toBe(20);
    expect(totals.hedgerow.postIntervention).toBe(25);
    expect(totals.watercourse.baseline).toBe(5);
    expect(totals.watercourse.postIntervention).toBe(0);
  });

  it("never lets units from one module fill a gap in another", () => {
    const totals = totalsFromParcels([
      { stage: "baseline", module: "hedgerow", units: 10 },
      { stage: "created", module: "area", units: 1000 },
    ] as never);
    expect(totals.hedgerow.postIntervention).toBe(0);
    expect(totals.area.baseline).toBe(0);
  });

  it("returns zeroes for no parcels", () => {
    const totals = totalsFromParcels([]);
    expect(totals.area.baseline).toBe(0);
    expect(totals.watercourse.postIntervention).toBe(0);
  });

  it("skips non-finite unit values rather than poisoning a total", () => {
    const totals = totalsFromParcels([
      { stage: "baseline", module: "area", units: 50 },
      { stage: "baseline", module: "area", units: Number.NaN },
    ] as never);
    expect(totals.area.baseline).toBe(50);
  });

  it("accepts Prisma decimal values expressed as strings", () => {
    const totals = totalsFromParcels([
      { stage: "baseline", module: "area", units: "12.5" },
      { stage: "created", module: "area", units: "20.25" },
    ] as never);
    expect(totals.area.baseline).toBeCloseTo(12.5, 10);
    expect(totals.area.postIntervention).toBeCloseTo(20.25, 10);
  });
});
