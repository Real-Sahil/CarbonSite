// How far an organisation is from its reduction target. A straight line runs from the baseline
// period's total to the target level at the target date; the period being read is compared with
// that line. A complete period is compared in full, one still running pro rata, so the first
// months of a year do not read as "ahead" only because little has happened yet.

export type GlidepathInput = {
  /** Baseline period total, tCO2e. */
  baselineTonnes: number;
  /** Level the target reaches, tCO2e a year. */
  targetTonnes: number;
  baselineEnd: Date;
  targetEnd: Date;
  periodStart: Date;
  periodEnd: Date;
  /** Emissions recorded in the period so far, tCO2e. */
  actualTonnes: number;
  now: Date;
};

export type GlidepathResult = {
  /** Allowed emissions for the portion of the period that has elapsed, tCO2e. */
  expectedTonnes: number;
  /** Positive: above the line (behind). Negative: below it (ahead). */
  gapTonnes: number;
  status: "ahead" | "on_track" | "behind";
  /** The period is still running, so the comparison is pro rata. */
  partial: boolean;
};

const DAY = 86_400_000;

/** Within 2% of the line counts as on track. */
const ON_TRACK_BAND = 0.02;

export function glidepath(i: GlidepathInput): GlidepathResult | null {
  const span = i.targetEnd.getTime() - i.baselineEnd.getTime();
  if (!(span > 0)) return null;
  if (![i.baselineTonnes, i.targetTonnes, i.actualTonnes].every(Number.isFinite)) return null;
  if (i.baselineTonnes <= 0) return null;
  const length = i.periodEnd.getTime() - i.periodStart.getTime() + DAY;
  if (!(length > 0)) return null;

  const t = Math.min(1, Math.max(0, (i.periodEnd.getTime() - i.baselineEnd.getTime()) / span));
  const yearLevel = i.baselineTonnes + (i.targetTonnes - i.baselineTonnes) * t;

  const elapsed = Math.min(1, Math.max(0, (i.now.getTime() - i.periodStart.getTime() + DAY) / length));
  const partial = i.now.getTime() < i.periodEnd.getTime();
  const expectedTonnes = yearLevel * (partial ? elapsed : 1);
  const gapTonnes = i.actualTonnes - expectedTonnes;
  const band = Math.abs(expectedTonnes) * ON_TRACK_BAND;
  const status = gapTonnes > band ? "behind" : gapTonnes < -band ? "ahead" : "on_track";
  return { expectedTonnes, gapTonnes, status, partial };
}
