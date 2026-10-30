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

/** Iterations used for an inventory small enough to afford them. */
const DEFAULT_ITERATIONS = 5000;
/** Fewest iterations a large inventory is ever given. */
const MIN_ITERATIONS = 1000;
/** Ceiling on iterations x records per call, so a 100k-record run finishes inside a serverless request. */
const MAX_DRAWS = 50_000_000;

/**
 * Default iteration count for an inventory of `recordCount` records. Up to
 * 10,000 records it is 5,000, as before; beyond that it falls towards 1,000 to
 * keep the draws bounded. A sum of tens of thousands of independent records is
 * close to normal, so its percentiles settle with far fewer iterations. The
 * count used is stored on the result, so a figure can always be re-run.
 */
export function defaultIterations(recordCount: number): number {
  if (recordCount <= 0) return DEFAULT_ITERATIONS;
  return Math.max(MIN_ITERATIONS, Math.min(DEFAULT_ITERATIONS, Math.floor(MAX_DRAWS / recordCount)));
}

export function runMonteCarlo(
  records: MonteCarloRecordInput[],
  options: { iterations?: number; seed?: number } = {},
): MonteCarloResult {
  const iterations = options.iterations ?? defaultIterations(records.length);
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

  // ln(geometricStdDev) is the lognormal distribution's sigma parameter. It is
  // the same in every iteration, so take it (and the medians) out of the hot
  // loop: the loop runs iterations x records times. Guard exactly 1 (zero
  // uncertainty): sigma is 0 and the draw is the median, which is valid, not an
  // error. The draws and their order are unchanged, so results stay identical.
  const count = simulated.length;
  const medians = new Float64Array(count);
  const sigmas = new Float64Array(count);
  for (let k = 0; k < count; k++) {
    medians[k] = simulated[k].totalCo2e;
    sigmas[k] = Math.log(simulated[k].geometricStdDev);
  }

  const totals = new Array<number>(iterations);
  for (let i = 0; i < iterations; i++) {
    let sum = fixedOffset;
    for (let k = 0; k < count; k++) {
      const z = standardNormal(rand);
      sum += medians[k] * Math.exp(z * sigmas[k]);
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
