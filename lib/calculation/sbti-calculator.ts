// Science-Based Targets initiative (SBTi) pathway calculator.
// Helps orgs calculate annual reduction targets to meet 1.5°C climate goal.

export type SBTiPathway = "1.5C" | "2C" | "2.5C";

export type SBTiTargetRequest = {
  baselineYear: number; // year baseline emissions measured (e.g., 2024)
  baselineEmissions: number; // kg CO2e
  targetYear: number; // year to reach target (e.g., 2030, 2040)
  pathway: SBTiPathway; // climate scenario
  baselineScope?: {
    scope1: number;
    scope2: number;
    scope3: number;
  };
};

export type AnnualReductionTarget = {
  year: number;
  targetEmissions: number; // kg CO2e at end of year
  annualReductionRate: number; // % reduction from previous year
  annualReductionAmount: number; // kg CO2e to reduce
  cumulativeReduction: number; // % reduction from baseline
  onTrack: boolean; // is this year achievable?
};

export type SBTiPathwayResult = {
  baselineYear: number;
  baselineEmissions: number;
  targetYear: number;
  targetEmissions: number; // emissions at target year
  totalReductionNeeded: number; // kg CO2e to cut
  totalReductionPercent: number; // % reduction required
  annualReductionRate: number; // average annual % reduction
  yearsToTarget: number;
  pathway: SBTiPathway;
  pathwayDescription: string;
  annualTargets: AnnualReductionTarget[];
  recommendations: string[];
};

// SBTi reduction rates by pathway and sector
// Based on IPCC AR6 and SBTi methodology
const SBTi_REDUCTION_RATES: Record<SBTiPathway, number> = {
  "1.5C": 0.042, // 4.2% annual reduction to hit 1.5°C
  "2C": 0.030, // 3.0% annual reduction for 2°C
  "2.5C": 0.020, // 2.0% annual reduction for 2.5°C
};

const PATHWAY_DESCRIPTIONS: Record<SBTiPathway, string> = {
  "1.5C": "Paris Agreement 1.5°C limit (most ambitious; requires deep systemic change)",
  "2C": "Paris Agreement 2°C limit (challenging; requires significant action)",
  "2.5C": "Intermediate pathway between 2°C and current trajectory",
};

export function calculateSBTiPathway(req: SBTiTargetRequest): SBTiPathwayResult {
  const yearsToTarget = req.targetYear - req.baselineYear;
  if (yearsToTarget <= 0) {
    throw new Error("Target year must be after baseline year");
  }

  const annualReductionRate = SBTi_REDUCTION_RATES[req.pathway];
  const reductionFactor = Math.pow(1 - annualReductionRate, yearsToTarget);
  const targetEmissions = req.baselineEmissions * reductionFactor;
  const totalReductionNeeded = req.baselineEmissions - targetEmissions;
  const totalReductionPercent = (totalReductionNeeded / req.baselineEmissions) * 100;

  const annualTargets: AnnualReductionTarget[] = [];
  let previousYearEmissions = req.baselineEmissions;

  for (let year = req.baselineYear + 1; year <= req.targetYear; year++) {
    const yearIndex = year - req.baselineYear;
    const emissions = req.baselineEmissions * Math.pow(1 - annualReductionRate, yearIndex);
    const annualReduction = previousYearEmissions - emissions;
    const annualReductionRate = (annualReduction / previousYearEmissions) * 100;
    const cumulativeReduction = ((previousYearEmissions - emissions) / req.baselineEmissions) * 100;

    annualTargets.push({
      year,
      targetEmissions: emissions,
      annualReductionRate: annualReductionRate,
      annualReductionAmount: annualReduction,
      cumulativeReduction: cumulativeReduction,
      onTrack: true,
    });

    previousYearEmissions = emissions;
  }

  const recommendations = generateRecommendations(req, annualReductionRate);

  return {
    baselineYear: req.baselineYear,
    baselineEmissions: req.baselineEmissions,
    targetYear: req.targetYear,
    targetEmissions: Math.round(targetEmissions),
    totalReductionNeeded: Math.round(totalReductionNeeded),
    totalReductionPercent: Math.round(totalReductionPercent * 100) / 100,
    annualReductionRate: Math.round(annualReductionRate * 100 * 100) / 100,
    yearsToTarget,
    pathway: req.pathway,
    pathwayDescription: PATHWAY_DESCRIPTIONS[req.pathway],
    annualTargets,
    recommendations,
  };
}

function generateRecommendations(req: SBTiTargetRequest, annualRate: number): string[] {
  const recommendations: string[] = [];

  // Rate-based recommendations
  if (annualRate >= 0.04) {
    recommendations.push("Annual reduction rate 4%+: Requires systematic operational changes (energy efficiency, renewable procurement, supply chain optimization)");
  } else if (annualRate >= 0.03) {
    recommendations.push("Annual reduction rate 3-4%: Achievable with steady investment in efficiency, renewable energy, and supplier engagement");
  } else {
    recommendations.push("Annual reduction rate <3%: Moderate changes required; focus on quick wins (LED lighting, insulation, waste reduction)");
  }

  // Scope-specific if provided
  if (req.baselineScope) {
    const totalScope = req.baselineScope.scope1 + req.baselineScope.scope2 + req.baselineScope.scope3;
    const scope3Pct = (req.baselineScope.scope3 / totalScope) * 100;

    if (scope3Pct > 60) {
      recommendations.push("Scope 3 >60% of emissions: Prioritize supplier engagement and category-specific initiatives (e.g., sustainable procurement, logistics optimization)");
    }
    if (req.baselineScope.scope2 > totalScope * 0.3) {
      recommendations.push("Scope 2 >30% of emissions: Transition to renewable energy or green tariffs");
    }
    if (req.baselineScope.scope1 > totalScope * 0.3) {
      recommendations.push("Scope 1 >30% of emissions: Fleet electrification, fuel switching, or process optimization");
    }
  }

  // Timing recommendations
  const yearsToTarget = req.targetYear - req.baselineYear;
  if (yearsToTarget < 5) {
    recommendations.push(`Urgent timeline: ${yearsToTarget}-year target requires immediate action across all areas`);
  } else if (yearsToTarget >= 10) {
    recommendations.push(`Long-term trajectory: ${yearsToTarget}-year target allows phased capital investment planning`);
  }

  // Pathway-specific guidance
  if (req.pathway === "1.5C") {
    recommendations.push("1.5°C pathway: Target requires innovation (e.g., carbon capture, alternative fuels) alongside operational improvements");
  } else if (req.pathway === "2.5C") {
    recommendations.push("2.5°C pathway: Conservative pathway; consider accelerating to 2°C for competitive climate leadership");
  }

  return recommendations;
}

// Helper: Calculate current year's progress
export function assessYearlyProgress(
  pathway: SBTiPathwayResult,
  currentYearEmissions: number,
): {
  status: "on-track" | "ahead" | "behind";
  variance: number; // % difference from target
  yearsAhead: number; // if ahead, how many years of progress gained
} {
  const currentYear = new Date().getFullYear();
  const target = pathway.annualTargets.find((t) => t.year === currentYear);

  if (!target) {
    return { status: "behind", variance: 100, yearsAhead: 0 };
  }

  const variance = ((currentYearEmissions - target.targetEmissions) / target.targetEmissions) * 100;

  let yearsAhead = 0;
  if (variance < 0) {
    // Ahead of schedule
    for (let i = 0; i < pathway.annualTargets.length; i++) {
      if (currentYearEmissions <= pathway.annualTargets[i].targetEmissions) {
        yearsAhead = pathway.annualTargets[i].year - currentYear;
        break;
      }
    }
  }

  return {
    status: variance > 5 ? "behind" : variance < -5 ? "ahead" : "on-track",
    variance: Math.round(variance * 100) / 100,
    yearsAhead,
  };
}

// Helper: Get milestone targets (useful for multi-year planning)
export function getMilestones(
  pathway: SBTiPathwayResult,
  milestoneYears: number[] = [2030, 2035, 2040, 2050],
): Array<{ year: number; emissions: number; achieved: boolean }> {
  return milestoneYears
    .filter((year) => year >= pathway.baselineYear && year <= pathway.targetYear)
    .map((year) => {
      const target = pathway.annualTargets.find((t) => t.year === year);
      return {
        year,
        emissions: target?.targetEmissions || 0,
        achieved: false, // Updated based on actual data
      };
    });
}
