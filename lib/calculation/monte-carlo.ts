// Monte Carlo propagation of record-level uncertainty to an inventory,
// scope, or category total.
//
// Naive practice sums each record's confidence-interval margin linearly:
// margin_total = sum(margin_i). That overstates the combined uncertainty,
// because it implicitly assumes every record's error moves in lockstep —
// all records over-estimate together, or all under-estimate together. When
// N independent uncertain quantities are summed, it is their VARIANCES that
// add, not their standard deviations: the combined standard deviation grows
// with sqrt(N) of the average per-record variance, not with N. Simulating
// each record from its own pedigree-derived lognormal distribution many
// times and summing the draws captures that diversification directly,
// without approximating the sum of lognormals analytically (it has no
// closed form). The result is always at least as tight as, and in practice
// materially tighter than, naive linear summation once more than a handful
// of independent records combine — see naiveLinearInterval() below, which
// exists so callers and tests can show that gap as a real, checked number.

export interface MonteCarloRecordInput {
  /** This record's calculated CO2e (kg) — the median of its distribution. */
  totalCo2e: number;
  /** Geometric standard deviation of the record's lognormal uncertainty. 1 = no uncertainty. */
  geometricStdDev: number;
}

export interface MonteCarloResult {
  mean: number;
  median: number;
  p2_5: number;
  p97_5: number;
  iterations: number;
  seed: number;
}

/**
 * Deterministic PRNG (mulberry32). The same seed always reproduces the same
 * simulated draws — required so a Monte Carlo result can be re-verified and
 * so tests are not flaky.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draw via the Box-Muller transform over a uniform PRNG. */
function standardNormal(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function runMonteCarlo(
  records: MonteCarloRecordInput[],
  options: { iterations?: number; seed?: number } = {},
): MonteCarloResult {
  const iterations = options.iterations ?? 5000;
  const seed = options.seed ?? 42;
  const rand = mulberry32(seed);

  // A record with zero or negative CO2e has no meaningful multiplicative
  // (lognormal) spread — ln(0) is undefined — so it is carried through as a
  // fixed offset rather than simulated.
  const simulated = records.filter((r) => r.totalCo2e > 0);
  const fixedOffset = records
    .filter((r) => r.totalCo2e <= 0)
    .reduce((sum, r) => sum + r.totalCo2e, 0);

  if (simulated.length === 0) {
    return {
      mean: fixedOffset,
      median: fixedOffset,
      p2_5: fixedOffset,
      p97_5: fixedOffset,
      iterations,
      seed,
    };
  }

  const totals = new Array<number>(iterations);
  for (let i = 0; i < iterations; i++) {
    let sum = fixedOffset;
    for (const record of simulated) {
      // ln(geometricStdDev) is the lognormal distribution's sigma parameter;
      // guard against exactly 1 (zero uncertainty) producing ln(1) = 0,
      // which is valid (the draw always returns the median) rather than an
      // error, so no epsilon nudge is needed here.
      const sigma = Math.log(record.geometricStdDev);
      const z = standardNormal(rand);
      sum += record.totalCo2e * Math.exp(z * sigma);
    }
    totals[i] = sum;
  }

  totals.sort((a, b) => a - b);
  const mean = totals.reduce((a, b) => a + b, 0) / iterations;
  const percentile = (p: number) => {
    const idx = Math.min(iterations - 1, Math.max(0, Math.round(p * (iterations - 1))));
    return totals[idx];
  };

  return {
    mean,
    median: percentile(0.5),
    p2_5: percentile(0.025),
    p97_5: percentile(0.975),
    iterations,
    seed,
  };
}

/**
 * The naive alternative this module replaces: summing each record's own
 * (lower, upper) confidence interval bound linearly, as though every
 * record's error moved together. Exists so a Monte Carlo result can be
 * shown next to what linear summation would have claimed, and so tests can
 * assert the Monte Carlo interval is the narrower — statistically correct —
 * one once enough independent records are combined.
 */
export function naiveLinearInterval(
  records: { lower: number; upper: number }[],
): { lower: number; upper: number } {
  return {
    lower: records.reduce((sum, r) => sum + r.lower, 0),
    upper: records.reduce((sum, r) => sum + r.upper, 0),
  };
}
