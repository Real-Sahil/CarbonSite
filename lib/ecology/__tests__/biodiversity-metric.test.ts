import { describe, it, expect } from "vitest";
import {
  DISTINCTIVENESS_SCORE,
  CONDITION_SCORE,
  STRATEGIC_SIGNIFICANCE_MULTIPLIER,
  DIFFICULTY_MULTIPLIER,
  SPATIAL_RISK_MULTIPLIER,
  timeToTargetMultiplier,
  baselineUnits,
  createdUnits,
  balanceModule,
  assessNetGain,
  checkTradingRule,
  buildMonitoringSchedule,
  REQUIRED_NET_GAIN_PERCENT,
  BNG_SECURING_YEARS,
  DEFAULT_MONITORING_YEARS,
} from "../biodiversity-metric";

describe("metric multiplier tables", () => {
  it("scores distinctiveness on the published 0 to 8 scale", () => {
    expect(DISTINCTIVENESS_SCORE.very_low).toBe(0);
    expect(DISTINCTIVENESS_SCORE.low).toBe(2);
    expect(DISTINCTIVENESS_SCORE.medium).toBe(4);
    expect(DISTINCTIVENESS_SCORE.high).toBe(6);
    expect(DISTINCTIVENESS_SCORE.very_high).toBe(8);
  });

  it("scores condition from 1 to 3 with unassessed treated as poor", () => {
    expect(CONDITION_SCORE.poor).toBe(1);
    expect(CONDITION_SCORE.not_assessed).toBe(1);
    expect(CONDITION_SCORE.fairly_poor).toBe(1.5);
    expect(CONDITION_SCORE.moderate).toBe(2);
    expect(CONDITION_SCORE.fairly_good).toBe(2.5);
    expect(CONDITION_SCORE.good).toBe(3);
  });

  it("uplifts for strategic significance", () => {
    expect(STRATEGIC_SIGNIFICANCE_MULTIPLIER.low).toBe(1.0);
    expect(STRATEGIC_SIGNIFICANCE_MULTIPLIER.medium).toBeCloseTo(1.1, 10);
    expect(STRATEGIC_SIGNIFICANCE_MULTIPLIER.high).toBeCloseTo(1.15, 10);
  });

  it("discounts hard-to-create habitat steeply", () => {
    expect(DIFFICULTY_MULTIPLIER.low).toBe(1.0);
    expect(DIFFICULTY_MULTIPLIER.medium).toBeCloseTo(0.67, 10);
    expect(DIFFICULTY_MULTIPLIER.high).toBeCloseTo(0.33, 10);
    expect(DIFFICULTY_MULTIPLIER.very_high).toBeCloseTo(0.1, 10);
  });

  it("halves the value of distant off-site compensation", () => {
    expect(SPATIAL_RISK_MULTIPLIER.on_site).toBe(1.0);
    expect(SPATIAL_RISK_MULTIPLIER.outside_neighbouring).toBe(0.75);
    expect(SPATIAL_RISK_MULTIPLIER.outside_distant).toBe(0.5);
  });
});

describe("timeToTargetMultiplier", () => {
  it("does not discount habitat that is already at target", () => {
    expect(timeToTargetMultiplier(0)).toBe(1);
    expect(timeToTargetMultiplier(-5)).toBe(1);
  });

  it("discounts at 3.5% a year", () => {
    expect(timeToTargetMultiplier(1)).toBeCloseTo(0.9662, 4);
    expect(timeToTargetMultiplier(5)).toBeCloseTo(0.842, 3);
    expect(timeToTargetMultiplier(10)).toBeCloseTo(0.7089, 4);
    expect(timeToTargetMultiplier(30)).toBeCloseTo(0.3563, 4);
  });

  it("credits nothing beyond the 30 year obligation", () => {
    // Value arriving after the securing period ends is not secured at all, so
    // a 50 year target is worth exactly what a 30 year one is.
    expect(timeToTargetMultiplier(50)).toBeCloseTo(timeToTargetMultiplier(30), 10);
  });

  it("decreases monotonically", () => {
    for (let y = 1; y <= 30; y++) {
      expect(timeToTargetMultiplier(y)).toBeLessThan(timeToTargetMultiplier(y - 1));
    }
  });
});

describe("baselineUnits", () => {
  it("multiplies size, distinctiveness, condition and strategic significance", () => {
    // 2 ha x 6 (high) x 2 (moderate) x 1.0 = 24 units
    expect(
      baselineUnits({
        size: 2,
        distinctiveness: "high",
        condition: "moderate",
        strategicSignificance: "low",
      }),
    ).toBeCloseTo(24, 10);
  });

  it("gives very low distinctiveness habitat no value at all", () => {
    // Hardstanding and buildings contribute nothing to a baseline.
    expect(
      baselineUnits({
        size: 100,
        distinctiveness: "very_low",
        condition: "good",
        strategicSignificance: "high",
      }),
    ).toBe(0);
  });

  it("applies the strategic significance uplift", () => {
    const plain = baselineUnits({
      size: 1,
      distinctiveness: "medium",
      condition: "good",
      strategicSignificance: "low",
    });
    const strategic = baselineUnits({
      size: 1,
      distinctiveness: "medium",
      condition: "good",
      strategicSignificance: "high",
    });
    expect(strategic / plain).toBeCloseTo(1.15, 10);
  });

  it("treats a negative size as zero rather than producing negative units", () => {
    expect(
      baselineUnits({
        size: -3,
        distinctiveness: "high",
        condition: "good",
        strategicSignificance: "low",
      }),
    ).toBe(0);
  });
});

describe("createdUnits", () => {
  it("applies difficulty, time and spatial risk on top of the base terms", () => {
    // 1 ha x 4 (medium) x 2 (moderate) x 1.0 = 8 base units.
    // x 0.67 difficulty x 0.7089 (10 years) x 0.75 spatial = 2.85 units.
    const units = createdUnits({
      size: 1,
      distinctiveness: "medium",
      condition: "moderate",
      strategicSignificance: "low",
      difficulty: "medium",
      yearsToTargetCondition: 10,
      spatialRisk: "outside_neighbouring",
    });
    expect(units).toBeCloseTo(8 * 0.67 * timeToTargetMultiplier(10) * 0.75, 8);
    expect(units).toBeLessThan(8);
  });

  it("is worth far less than equivalent existing habitat", () => {
    const existing = baselineUnits({
      size: 1,
      distinctiveness: "high",
      condition: "good",
      strategicSignificance: "low",
    });
    const promised = createdUnits({
      size: 1,
      distinctiveness: "high",
      condition: "good",
      strategicSignificance: "low",
      difficulty: "high",
      yearsToTargetCondition: 30,
      spatialRisk: "outside_distant",
    });
    // Hard to create, thirty years away and miles off site: worth under 10%.
    expect(promised / existing).toBeLessThan(0.1);
  });

  it("matches baseline value when nothing is discounted", () => {
    const args = {
      size: 3,
      distinctiveness: "medium" as const,
      condition: "good" as const,
      strategicSignificance: "low" as const,
    };
    expect(
      createdUnits({
        ...args,
        difficulty: "low",
        yearsToTargetCondition: 0,
        spatialRisk: "on_site",
      }),
    ).toBeCloseTo(baselineUnits(args), 10);
  });
});

describe("balanceModule", () => {
  it("passes at exactly 10%", () => {
    const balance = balanceModule("area", 100, 110);
    expect(balance.netGainPercent).toBeCloseTo(10, 10);
    expect(balance.meetsRequirement).toBe(true);
    expect(balance.unitsShortfall).toBeCloseTo(0, 10);
  });

  it("fails just below 10% and reports the unit shortfall", () => {
    const balance = balanceModule("area", 100, 109);
    expect(balance.meetsRequirement).toBe(false);
    expect(balance.unitsShortfall).toBeCloseTo(1, 10);
  });

  it("reports a loss as a negative percentage", () => {
    const balance = balanceModule("hedgerow", 100, 80);
    expect(balance.netGainPercent).toBeCloseTo(-20, 10);
    expect(balance.changeUnits).toBeCloseTo(-20, 10);
    expect(balance.meetsRequirement).toBe(false);
  });

  it("passes a module the scheme never engaged", () => {
    // No watercourse on site and none created: the module is not engaged and
    // cannot fail. Treating it as an infinite gain or a failure would both be
    // wrong.
    const balance = balanceModule("watercourse", 0, 0);
    expect(balance.baselineIsZero).toBe(true);
    expect(balance.meetsRequirement).toBe(true);
    expect(balance.netGainPercent).toBe(0);
  });

  it("treats habitat created where there was none as a gain", () => {
    const balance = balanceModule("watercourse", 0, 5);
    expect(balance.meetsRequirement).toBe(true);
    expect(balance.netGainPercent).toBe(100);
  });
});

describe("assessNetGain", () => {
  it("requires the 10% in every engaged module independently", () => {
    // Comfortably ahead on area, but 300m of hedgerow removed and 250 replaced.
    // This is the rule that catches most schemes out.
    const result = assessNetGain({
      area: { baseline: 100, postIntervention: 140 },
      hedgerow: { baseline: 30, postIntervention: 25 },
      watercourse: { baseline: 0, postIntervention: 0 },
    });

    expect(result.meetsRequirement).toBe(false);
    expect(result.failingModules).toEqual(["hedgerow"]);
    expect(result.summary).toContain("Hedgerows");
    expect(result.summary).toContain("independently");
  });

  it("passes when every engaged module clears the bar", () => {
    const result = assessNetGain({
      area: { baseline: 100, postIntervention: 111 },
      hedgerow: { baseline: 10, postIntervention: 12 },
      watercourse: { baseline: 0, postIntervention: 0 },
    });
    expect(result.meetsRequirement).toBe(true);
    expect(result.failingModules).toEqual([]);
  });

  it("says nothing has been recorded rather than claiming a pass", () => {
    const result = assessNetGain({
      area: { baseline: 0, postIntervention: 0 },
      hedgerow: { baseline: 0, postIntervention: 0 },
      watercourse: { baseline: 0, postIntervention: 0 },
    });
    expect(result.summary).toContain("No habitat has been recorded");
  });

  it("returns a balance for all three modules regardless of engagement", () => {
    const result = assessNetGain({
      area: { baseline: 1, postIntervention: 2 },
      hedgerow: { baseline: 0, postIntervention: 0 },
      watercourse: { baseline: 0, postIntervention: 0 },
    });
    expect(result.modules).toHaveLength(3);
    expect(result.modules.map((m) => m.module)).toEqual(["area", "hedgerow", "watercourse"]);
  });
});

describe("checkTradingRule", () => {
  it("requires no compensation for very low distinctiveness habitat", () => {
    const check = checkTradingRule({
      lostDistinctiveness: "very_low",
      lostBroadHabitat: "Urban",
      replacementDistinctiveness: "very_low",
      replacementBroadHabitat: "Urban",
    });
    expect(check.satisfied).toBe(true);
  });

  it("refuses to let valuable habitat be traded down", () => {
    const check = checkTradingRule({
      lostDistinctiveness: "high",
      lostBroadHabitat: "Grassland",
      replacementDistinctiveness: "low",
      replacementBroadHabitat: "Grassland",
    });
    expect(check.satisfied).toBe(false);
    expect(check.reason).toContain("lower distinctiveness");
  });

  it("accepts trading up", () => {
    const check = checkTradingRule({
      lostDistinctiveness: "low",
      lostBroadHabitat: "Grassland",
      replacementDistinctiveness: "high",
      replacementBroadHabitat: "Woodland",
    });
    expect(check.satisfied).toBe(true);
    expect(check.reason).toContain("higher distinctiveness");
  });

  it("requires the same broad habitat at medium and above", () => {
    // Species-rich grassland cannot be swapped for equally distinctive
    // woodland: the habitat itself is what is being compensated for.
    const check = checkTradingRule({
      lostDistinctiveness: "medium",
      lostBroadHabitat: "Grassland",
      replacementDistinctiveness: "medium",
      replacementBroadHabitat: "Woodland",
    });
    expect(check.satisfied).toBe(false);
    expect(check.reason).toContain("same broad habitat type");
  });

  it("accepts like for like at medium", () => {
    const check = checkTradingRule({
      lostDistinctiveness: "medium",
      lostBroadHabitat: "Grassland",
      replacementDistinctiveness: "medium",
      replacementBroadHabitat: "grassland",
    });
    expect(check.satisfied).toBe(true);
  });

  it("allows any habitat of equal distinctiveness below medium", () => {
    const check = checkTradingRule({
      lostDistinctiveness: "low",
      lostBroadHabitat: "Grassland",
      replacementDistinctiveness: "low",
      replacementBroadHabitat: "Woodland",
    });
    expect(check.satisfied).toBe(true);
  });

  it("treats very high distinctiveness habitat as needing bespoke compensation", () => {
    const traded = checkTradingRule({
      lostDistinctiveness: "very_high",
      lostBroadHabitat: "Lowland fen",
      replacementDistinctiveness: "very_high",
      replacementBroadHabitat: "Ancient woodland",
    });
    expect(traded.satisfied).toBe(false);
    expect(traded.reason).toContain("bespoke");

    const likeForLike = checkTradingRule({
      lostDistinctiveness: "very_high",
      lostBroadHabitat: "Lowland fen",
      replacementDistinctiveness: "very_high",
      replacementBroadHabitat: "Lowland fen",
    });
    expect(likeForLike.satisfied).toBe(true);
    expect(likeForLike.reason).toContain("planning authority");
  });
});

describe("buildMonitoringSchedule", () => {
  const START = new Date("2026-04-01T00:00:00Z");

  it("front-loads monitoring then drops to five-yearly", () => {
    const schedule = buildMonitoringSchedule(START);
    expect(schedule.map((s) => s.year)).toEqual(DEFAULT_MONITORING_YEARS);
  });

  it("dates each visit from the commencement year", () => {
    const schedule = buildMonitoringSchedule(START);
    expect(schedule[0].dueOn.getFullYear()).toBe(2027);
    expect(schedule[schedule.length - 1].dueOn.getFullYear()).toBe(2056);
  });

  it("runs to the end of the 30 year obligation and no further", () => {
    const schedule = buildMonitoringSchedule(START, [1, 30, 35, 40]);
    expect(schedule.map((s) => s.year)).toEqual([1, 30]);
  });

  it("drops non-positive years", () => {
    const schedule = buildMonitoringSchedule(START, [0, -1, 5]);
    expect(schedule.map((s) => s.year)).toEqual([5]);
  });

  it("accepts a custom schedule", () => {
    const schedule = buildMonitoringSchedule(START, [2, 7, 12]);
    expect(schedule.map((s) => s.year)).toEqual([2, 7, 12]);
  });
});

describe("statutory constants", () => {
  it("holds the mandatory uplift and securing period", () => {
    expect(REQUIRED_NET_GAIN_PERCENT).toBe(10);
    expect(BNG_SECURING_YEARS).toBe(30);
  });
});
