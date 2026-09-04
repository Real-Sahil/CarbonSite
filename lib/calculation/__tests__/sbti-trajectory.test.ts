import { describe, expect, test } from "vitest";
import {
  baselineTotalTco2e,
  buildSbtiAlerts,
  buildSbtiTrajectory,
  expectedTco2eForYear,
  type SbtiTargetInput,
} from "../sbti-trajectory";

const target: SbtiTargetInput = {
  pathway: "1.5C",
  baseYear: 2020,
  baselineScope1Tco2e: 600,
  baselineScope2Tco2e: 300,
  baselineScope3Tco2e: 100,
  nearTermYear: 2030,
  nearTermReductionPct: 50,
  netZeroYear: 2050,
  netZeroReductionPct: 90,
};

describe("baselineTotalTco2e", () => {
  test("sums all three scopes", () => {
    expect(baselineTotalTco2e(target)).toBe(1000);
  });

  test("treats a missing scope 3 as zero", () => {
    expect(baselineTotalTco2e({ ...target, baselineScope3Tco2e: null })).toBe(900);
  });
});

describe("expectedTco2eForYear", () => {
  test("returns the full baseline at the base year", () => {
    expect(expectedTco2eForYear(target, 2020)).toBe(1000);
  });

  test("halves by the near-term year at 50% reduction", () => {
    expect(expectedTco2eForYear(target, 2030)).toBeCloseTo(500, 5);
  });

  test("reaches 10% of baseline at net-zero (90% reduction)", () => {
    expect(expectedTco2eForYear(target, 2050)).toBeCloseTo(100, 5);
  });

  test("interpolates linearly at the midpoint of the near-term leg", () => {
    // Halfway from 2020 (1000) to 2030 (500) is 2025 -> 750.
    expect(expectedTco2eForYear(target, 2025)).toBeCloseTo(750, 5);
  });

  test("interpolates linearly at the midpoint of the net-zero leg", () => {
    // Halfway from 2030 (500) to 2050 (100) is 2040 -> 300.
    expect(expectedTco2eForYear(target, 2040)).toBeCloseTo(300, 5);
  });

  test("never goes negative even past net-zero", () => {
    expect(expectedTco2eForYear(target, 2100)).toBeGreaterThanOrEqual(0);
  });
});

describe("buildSbtiTrajectory", () => {
  test("marks a year with no actual data as no_data (past) or future", () => {
    const trajectory = buildSbtiTrajectory(target, new Map());
    const pastPoint = trajectory.find((p) => p.year === target.baseYear)!;
    const futurePoint = trajectory.find((p) => p.year === target.netZeroYear)!;
    expect(pastPoint.status).toBe("no_data");
    expect(futurePoint.status).toBe("future");
    expect(pastPoint.actualTco2e).toBeNull();
  });

  test("marks a year within 5% of the pathway as on_track", () => {
    const trajectory = buildSbtiTrajectory(target, new Map([[2030, 510]]));
    const point = trajectory.find((p) => p.year === 2030)!;
    expect(point.status).toBe("on_track");
    expect(point.deviationPercent).toBeCloseTo(2, 1);
  });

  test("marks a year more than 5% over the pathway as behind", () => {
    const trajectory = buildSbtiTrajectory(target, new Map([[2030, 650]]));
    const point = trajectory.find((p) => p.year === 2030)!;
    expect(point.status).toBe("behind");
    expect(point.deviationTco2e).toBeCloseTo(150, 5);
  });

  test("assigns the correct milestone label per leg", () => {
    const trajectory = buildSbtiTrajectory(target, new Map());
    expect(trajectory.find((p) => p.year === 2020)!.milestone).toBe("baseline");
    expect(trajectory.find((p) => p.year === 2025)!.milestone).toBe("near_term");
    expect(trajectory.find((p) => p.year === 2040)!.milestone).toBe("net_zero");
  });

  test("covers every year from base year to net-zero year inclusive", () => {
    const trajectory = buildSbtiTrajectory(target, new Map());
    expect(trajectory).toHaveLength(target.netZeroYear - target.baseYear + 1);
  });
});

describe("buildSbtiAlerts", () => {
  test("produces no alerts when nothing is behind", () => {
    const trajectory = buildSbtiTrajectory(target, new Map([[2025, 700]]));
    expect(buildSbtiAlerts(target, trajectory)).toEqual([]);
  });

  test("raises a critical alert for a large deviation near-term", () => {
    const trajectory = buildSbtiTrajectory(target, new Map([[2029, 950]]));
    const alerts = buildSbtiAlerts(target, trajectory);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[0].year).toBe(2029);
  });

  test("raises a lower-severity alert for a small deviation with time to correct", () => {
    // Expected at 2022 is 900 (20% of the way from 1000 to 500); 954 is a
    // 6% overshoot — behind, but not severely, and 8 years from near-term.
    const trajectory = buildSbtiTrajectory(target, new Map([[2022, 954]]));
    const alerts = buildSbtiAlerts(target, trajectory);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("info");
  });
});
