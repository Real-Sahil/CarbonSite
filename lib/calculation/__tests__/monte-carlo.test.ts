import { describe, it, expect } from "vitest";
import { runMonteCarlo, naiveLinearInterval } from "../monte-carlo";
import { pedigreeConfidenceInterval } from "../pedigree";

describe("runMonteCarlo", () => {
  it("is deterministic for a fixed seed", () => {
    const records = [
      { totalCo2e: 100, geometricStdDev: 1.2 },
      { totalCo2e: 50, geometricStdDev: 1.4 },
    ];
    const first = runMonteCarlo(records, { seed: 7, iterations: 1000 });
    const second = runMonteCarlo(records, { seed: 7, iterations: 1000 });
    expect(first.mean).toBe(second.mean);
    expect(first.p2_5).toBe(second.p2_5);
    expect(first.p97_5).toBe(second.p97_5);
  });

  it("produces a mean close to the sum of the record point estimates", () => {
    const records = [
      { totalCo2e: 100, geometricStdDev: 1.1 },
      { totalCo2e: 200, geometricStdDev: 1.1 },
      { totalCo2e: 300, geometricStdDev: 1.1 },
    ];
    const result = runMonteCarlo(records, { seed: 1, iterations: 20000 });
    expect(result.mean).toBeGreaterThan(590);
    expect(result.mean).toBeLessThan(610);
  });

  it("carries zero/negative records as a fixed offset rather than simulating them", () => {
    const result = runMonteCarlo(
      [
        { totalCo2e: 0, geometricStdDev: 1.5 },
        { totalCo2e: 100, geometricStdDev: 1 },
      ],
      { seed: 3, iterations: 500 },
    );
    expect(result.mean).toBeCloseTo(100, 0);
  });

  it("returns the fixed offset directly when every record has zero uncertainty spread to simulate", () => {
    const result = runMonteCarlo([{ totalCo2e: 0, geometricStdDev: 1 }], { seed: 1 });
    expect(result.mean).toBe(0);
    expect(result.p2_5).toBe(0);
    expect(result.p97_5).toBe(0);
  });

  // The core statistical property that justifies building Monte Carlo
  // propagation at all: summing many independent records' own confidence
  // intervals linearly (as if their errors moved in lockstep) overstates
  // uncertainty relative to simulating them as independent draws and
  // summing the draws, because independent variances add — not independent
  // standard deviations.
  it("produces a materially tighter total interval than naive linear summation across many independent records", () => {
    const gsd = 1.3;
    const perRecordCo2e = 100;
    const recordCount = 200;

    const records = Array.from({ length: recordCount }, () => ({
      totalCo2e: perRecordCo2e,
      geometricStdDev: gsd,
    }));

    const monteCarlo = runMonteCarlo(records, { seed: 11, iterations: 8000 });
    const monteCarloWidth = monteCarlo.p97_5 - monteCarlo.p2_5;

    const perRecordCi = pedigreeConfidenceInterval(perRecordCo2e, gsd);
    const naive = naiveLinearInterval(
      records.map(() => ({ lower: perRecordCi.lower, upper: perRecordCi.upper })),
    );
    const naiveWidth = naive.upper - naive.lower;

    expect(monteCarloWidth).toBeLessThan(naiveWidth * 0.5);
  });
});

describe("naiveLinearInterval", () => {
  it("sums lower and upper bounds independently", () => {
    const result = naiveLinearInterval([
      { lower: 10, upper: 20 },
      { lower: 5, upper: 8 },
    ]);
    expect(result.lower).toBe(15);
    expect(result.upper).toBe(28);
  });
});
