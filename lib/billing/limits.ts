export type Plan = "trial" | "starter" | "growth" | "enterprise";

interface PlanLimits {
  fieldSubmissionsPerMonth: number;
  reportsPerMonth: number;
  importsPerMonth: number;
  calculationRunsPerMonth: number;
  apiRequestsPerMonth: number;
  members: number;
  facilities: number;
}

const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  trial: {
    fieldSubmissionsPerMonth: 50,
    reportsPerMonth: 2,
    importsPerMonth: 5,
    calculationRunsPerMonth: 10,
    apiRequestsPerMonth: 1_000,
    members: 3,
    facilities: 2,
  },
  starter: {
    fieldSubmissionsPerMonth: 500,
    reportsPerMonth: 10,
    importsPerMonth: 25,
    calculationRunsPerMonth: 50,
    apiRequestsPerMonth: 10_000,
    members: 10,
    facilities: 10,
  },
  growth: {
    fieldSubmissionsPerMonth: 5_000,
    reportsPerMonth: 50,
    importsPerMonth: 100,
    calculationRunsPerMonth: 200,
    apiRequestsPerMonth: 100_000,
    members: 50,
    facilities: 50,
  },
  enterprise: {
    fieldSubmissionsPerMonth: Infinity,
    reportsPerMonth: Infinity,
    importsPerMonth: Infinity,
    calculationRunsPerMonth: Infinity,
    apiRequestsPerMonth: Infinity,
    members: Infinity,
    facilities: Infinity,
  },
};

export const PLAN_PRICES: Record<Plan, { monthly: number; annual: number }> = {
  trial:      { monthly: 0,   annual: 0 },
  starter:    { monthly: 49,  annual: 39 },
  growth:     { monthly: 149, annual: 119 },
  enterprise: { monthly: 0,   annual: 0 },
};

export const PLAN_LABELS: Record<Plan, string> = {
  trial:      "Trial",
  starter:    "Starter",
  growth:     "Growth",
  enterprise: "Enterprise",
};

export function getLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[(plan as Plan) ?? "trial"] ?? PLAN_LIMITS.trial;
}

export function usagePercent(used: number, limit: number): number {
  if (limit === Infinity || limit === 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}
