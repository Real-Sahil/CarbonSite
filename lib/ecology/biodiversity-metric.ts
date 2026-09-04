// The statutory biodiversity metric.
//
// Biodiversity Net Gain has been mandatory for development in England since
// February 2024: a development must deliver at least a 10% uplift in
// biodiversity value, measured in habitat units, and secure it for 30 years.
//
// Habitat value is measured in three separate modules, and the 10% must be met
// in each one independently. Units from one module never make up a shortfall
// in another: you cannot plant a hedge to compensate for a lost river.
//
//   Baseline units      = area x distinctiveness x condition x strategic significance
//   Post-intervention   = the same, multiplied by difficulty, time to target
//                         condition, and spatial risk
//
// Every multiplier below comes from the published metric. They are held here as
// named tables rather than loose numbers so a reviewer can check them against
// the source in one pass.

/** The three accounting modules. Each is balanced independently. */
export type BiodiversityModule = "area" | "hedgerow" | "watercourse";

export const BIODIVERSITY_MODULES: BiodiversityModule[] = ["area", "hedgerow", "watercourse"];

/** Statutory minimum uplift, as a percentage, required in every module. */
export const REQUIRED_NET_GAIN_PERCENT = 10;

/** Years a net gain must be secured and maintained for. */
export const BNG_SECURING_YEARS = 30;

// ─── Distinctiveness ─────────────────────────────────────────────────────────

export type Distinctiveness = "very_low" | "low" | "medium" | "high" | "very_high";

export const DISTINCTIVENESS_SCORE: Record<Distinctiveness, number> = {
  very_low: 0,
  low: 2,
  medium: 4,
  high: 6,
  very_high: 8,
};

export const DISTINCTIVENESS_ORDER: Distinctiveness[] = [
  "very_low",
  "low",
  "medium",
  "high",
  "very_high",
];

// ─── Condition ───────────────────────────────────────────────────────────────

export type HabitatCondition =
  | "not_assessed"
  | "poor"
  | "fairly_poor"
  | "moderate"
  | "fairly_good"
  | "good";

export const CONDITION_SCORE: Record<HabitatCondition, number> = {
  // Habitats where condition is not assessed score 1, the same as poor.
  not_assessed: 1,
  poor: 1,
  fairly_poor: 1.5,
  moderate: 2,
  fairly_good: 2.5,
  good: 3,
};

// ─── Strategic significance ──────────────────────────────────────────────────

export type StrategicSignificance = "low" | "medium" | "high";

export const STRATEGIC_SIGNIFICANCE_MULTIPLIER: Record<StrategicSignificance, number> = {
  /// Area not identified in the local strategy.
  low: 1.0,
  /// Location ecologically desirable but not in the local strategy.
  medium: 1.1,
  /// Formally identified in the local nature recovery strategy.
  high: 1.15,
};

// ─── Difficulty of creation or enhancement ───────────────────────────────────

export type Difficulty = "low" | "medium" | "high" | "very_high";

export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  low: 1.0,
  medium: 0.67,
  high: 0.33,
  very_high: 0.1,
};

// ─── Spatial risk ────────────────────────────────────────────────────────────

export type SpatialRisk = "on_site" | "outside_neighbouring" | "outside_distant";

export const SPATIAL_RISK_MULTIPLIER: Record<SpatialRisk, number> = {
  /// Inside the development site, or the same local planning authority or
  /// national character area.
  on_site: 1.0,
  /// Outside that area but in a neighbouring one.
  outside_neighbouring: 0.75,
  /// Further afield.
  outside_distant: 0.5,
};

// ─── Time to target condition ────────────────────────────────────────────────

/**
 * Habitat created today is not worth what mature habitat is worth, because it
 * takes years to reach the target condition and may fail on the way. The
 * metric discounts future value at 3.5% a year, the Green Book social discount
 * rate.
 *
 * Capped at the 30 year securing period: nothing is credited for value that
 * arrives after the obligation ends.
 */
export function timeToTargetMultiplier(yearsToTargetCondition: number): number {
  if (!Number.isFinite(yearsToTargetCondition) || yearsToTargetCondition <= 0) return 1;
  const years = Math.min(yearsToTargetCondition, BNG_SECURING_YEARS);
  return 1 / Math.pow(1.035, years);
}

// ─── Unit calculation ────────────────────────────────────────────────────────

export interface BaselineParcelInput {
  /// Hectares for area habitats, kilometres for hedgerows and watercourses.
  size: number;
  distinctiveness: Distinctiveness;
  condition: HabitatCondition;
  strategicSignificance: StrategicSignificance;
}

export interface CreatedParcelInput extends BaselineParcelInput {
  difficulty: Difficulty;
  yearsToTargetCondition: number;
  spatialRisk: SpatialRisk;
}

/**
 * Biodiversity units for a parcel as it exists today.
 * Very low distinctiveness habitat scores zero units by construction, which is
 * why hardstanding and buildings contribute nothing to a baseline.
 */
export function baselineUnits(parcel: BaselineParcelInput): number {
  const size = Math.max(0, parcel.size);
  return (
    size *
    DISTINCTIVENESS_SCORE[parcel.distinctiveness] *
    CONDITION_SCORE[parcel.condition] *
    STRATEGIC_SIGNIFICANCE_MULTIPLIER[parcel.strategicSignificance]
  );
}

/**
 * Biodiversity units for a parcel that will be created or enhanced, after the
 * three risk multipliers the metric applies to promised future habitat.
 */
export function createdUnits(parcel: CreatedParcelInput): number {
  return (
    baselineUnits(parcel) *
    DIFFICULTY_MULTIPLIER[parcel.difficulty] *
    timeToTargetMultiplier(parcel.yearsToTargetCondition) *
    SPATIAL_RISK_MULTIPLIER[parcel.spatialRisk]
  );
}

// ─── Net gain ────────────────────────────────────────────────────────────────

export interface ModuleBalance {
  module: BiodiversityModule;
  baselineUnits: number;
  postInterventionUnits: number;
  /// Absolute change in units. Negative means a loss.
  changeUnits: number;
  /// Percentage change against the baseline.
  netGainPercent: number;
  /// Units still needed to reach the statutory 10%. Zero once met.
  unitsShortfall: number;
  meetsRequirement: boolean;
  /// True when there was nothing of this kind on site to begin with.
  baselineIsZero: boolean;
}

/**
 * Balances one module.
 *
 * A zero baseline is the awkward case: percentage change is undefined, and
 * treating it as an infinite gain would let a scheme claim compliance for a
 * module it never touched. The metric's own position is that a module with no
 * baseline and no post-intervention habitat is simply not engaged, so it
 * passes; a zero baseline with habitat created is a gain and also passes.
 */
export function balanceModule(
  module: BiodiversityModule,
  baseline: number,
  postIntervention: number,
): ModuleBalance {
  const change = postIntervention - baseline;
  const baselineIsZero = baseline === 0;

  const required = baseline * (1 + REQUIRED_NET_GAIN_PERCENT / 100);

  // 100 x 1.1 is 110.00000000000001 in binary floating point, so a scheme
  // delivering exactly the statutory 10% would otherwise be reported as
  // failing by a hundred-billionth of a unit. The tolerance scales with the
  // baseline and sits far below any real ecological precision.
  const tolerance = Math.max(1, Math.abs(baseline)) * 1e-9;
  const meets = baselineIsZero || postIntervention + tolerance >= required;

  const rawShortfall = required - postIntervention;
  const shortfall = meets || rawShortfall <= tolerance ? 0 : rawShortfall;

  return {
    module,
    baselineUnits: baseline,
    postInterventionUnits: postIntervention,
    changeUnits: change,
    netGainPercent: baselineIsZero ? (postIntervention > 0 ? 100 : 0) : (change / baseline) * 100,
    unitsShortfall: shortfall,
    // With no baseline there is nothing to improve on, so the module cannot
    // fail. Any created habitat is a bonus rather than a requirement.
    meetsRequirement: meets,
    baselineIsZero,
  };
}

export interface AssessmentResult {
  modules: ModuleBalance[];
  /// True only when every engaged module independently meets the 10%.
  meetsRequirement: boolean;
  failingModules: BiodiversityModule[];
  /// Plain-language account for the planning submission and the audit record.
  summary: string;
}

/**
 * Balances all three modules and states whether the scheme delivers net gain.
 *
 * The rule that catches most schemes out is that the 10% is per module. A
 * scheme can be comfortably ahead on area habitats and still fail because it
 * removed 300 metres of hedgerow and replaced 250.
 */
export function assessNetGain(totals: {
  area: { baseline: number; postIntervention: number };
  hedgerow: { baseline: number; postIntervention: number };
  watercourse: { baseline: number; postIntervention: number };
}): AssessmentResult {
  const modules = BIODIVERSITY_MODULES.map((module) =>
    balanceModule(module, totals[module].baseline, totals[module].postIntervention),
  );

  const failing = modules.filter((m) => !m.meetsRequirement);
  const meets = failing.length === 0;

  const engaged = modules.filter((m) => !m.baselineIsZero || m.postInterventionUnits > 0);

  let summary: string;
  if (engaged.length === 0) {
    summary = "No habitat has been recorded, so no net gain position can be stated yet.";
  } else if (meets) {
    const parts = engaged.map(
      (m) => `${MODULE_LABEL[m.module]} ${m.netGainPercent >= 0 ? "+" : ""}${m.netGainPercent.toFixed(1)}%`,
    );
    summary = `Delivers biodiversity net gain in every engaged module: ${parts.join(", ")}. The statutory minimum is ${REQUIRED_NET_GAIN_PERCENT}% in each module independently.`;
  } else {
    const parts = failing.map(
      (m) =>
        `${MODULE_LABEL[m.module]} is ${m.netGainPercent.toFixed(1)}% against a required ${REQUIRED_NET_GAIN_PERCENT}%, a shortfall of ${m.unitsShortfall.toFixed(3)} units`,
    );
    summary = `Does not yet deliver biodiversity net gain. ${parts.join("; ")}. Each module must meet the ${REQUIRED_NET_GAIN_PERCENT}% independently, so a surplus elsewhere cannot make this up.`;
  }

  return { modules, meetsRequirement: meets, failingModules: failing.map((m) => m.module), summary };
}

export const MODULE_LABEL: Record<BiodiversityModule, string> = {
  area: "Area habitats",
  hedgerow: "Hedgerows",
  watercourse: "Watercourses",
};

export const MODULE_UNIT: Record<BiodiversityModule, string> = {
  area: "ha",
  hedgerow: "km",
  watercourse: "km",
};

// ─── Trading rules ───────────────────────────────────────────────────────────

export interface TradingCheck {
  satisfied: boolean;
  reason: string;
}

/**
 * The metric's trading rules stop a scheme swapping valuable habitat for a
 * larger area of something worthless. Compensation must be like for like or
 * better, and the constraint tightens as distinctiveness rises.
 *
 * Very high distinctiveness habitat is effectively irreplaceable: the rules
 * require bespoke compensation agreed with the planning authority rather than
 * a metric trade.
 */
export function checkTradingRule(params: {
  lostDistinctiveness: Distinctiveness;
  lostBroadHabitat: string;
  replacementDistinctiveness: Distinctiveness;
  replacementBroadHabitat: string;
}): TradingCheck {
  const lostRank = DISTINCTIVENESS_ORDER.indexOf(params.lostDistinctiveness);
  const replacementRank = DISTINCTIVENESS_ORDER.indexOf(params.replacementDistinctiveness);

  if (params.lostDistinctiveness === "very_low") {
    return {
      satisfied: true,
      reason: "Very low distinctiveness habitat carries no compensation requirement.",
    };
  }

  if (params.lostDistinctiveness === "very_high") {
    const sameHabitat =
      normaliseHabitat(params.lostBroadHabitat) === normaliseHabitat(params.replacementBroadHabitat);
    return {
      satisfied: sameHabitat && replacementRank >= lostRank,
      reason: sameHabitat && replacementRank >= lostRank
        ? "Replacement is the same very high distinctiveness habitat type. Bespoke compensation must still be agreed with the planning authority."
        : "Very high distinctiveness habitat requires bespoke like-for-like compensation agreed with the planning authority. It cannot be traded through the metric.",
    };
  }

  if (replacementRank < lostRank) {
    return {
      satisfied: false,
      reason: `Replacement habitat is of lower distinctiveness than what is lost (${DISTINCTIVENESS_LABEL[params.replacementDistinctiveness]} against ${DISTINCTIVENESS_LABEL[params.lostDistinctiveness]}). Compensation must be of the same distinctiveness or better.`,
    };
  }

  // Medium and above additionally require the same broad habitat type, so a
  // species-rich grassland cannot be replaced by an equally distinctive
  // woodland.
  if (lostRank >= DISTINCTIVENESS_ORDER.indexOf("medium")) {
    const sameHabitat =
      normaliseHabitat(params.lostBroadHabitat) === normaliseHabitat(params.replacementBroadHabitat);
    if (!sameHabitat && replacementRank === lostRank) {
      return {
        satisfied: false,
        reason: `Habitat of ${DISTINCTIVENESS_LABEL[params.lostDistinctiveness]} distinctiveness must be replaced by the same broad habitat type at the same distinctiveness or better, or by habitat of higher distinctiveness.`,
      };
    }
  }

  return {
    satisfied: true,
    reason: replacementRank > lostRank
      ? "Replacement habitat is of higher distinctiveness than what is lost, which satisfies the trading rules."
      : "Replacement is like for like and satisfies the trading rules.",
  };
}

export const DISTINCTIVENESS_LABEL: Record<Distinctiveness, string> = {
  very_low: "very low",
  low: "low",
  medium: "medium",
  high: "high",
  very_high: "very high",
};

function normaliseHabitat(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// ─── Monitoring schedule ─────────────────────────────────────────────────────

/**
 * The years a management and monitoring plan must report in. Monitoring is
 * front-loaded because that is when created habitat fails, then drops to
 * five-yearly once establishment is proven, running to the end of the 30 year
 * obligation.
 */
export const DEFAULT_MONITORING_YEARS = [1, 2, 3, 4, 5, 10, 15, 20, 25, 30];

export function buildMonitoringSchedule(
  startDate: Date,
  years: number[] = DEFAULT_MONITORING_YEARS,
): Array<{ year: number; dueOn: Date }> {
  return years
    .filter((y) => y > 0 && y <= BNG_SECURING_YEARS)
    .map((year) => {
      const dueOn = new Date(startDate);
      dueOn.setFullYear(dueOn.getFullYear() + year);
      return { year, dueOn };
    });
}
