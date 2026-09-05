import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

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

// Capability gates, distinct from the usage-volume limits above. These are
// enterprise-flavored features (back-office automation, IT procurement
// requirements) that Growth's flat price was previously handing out for
// free alongside every other feature. Mobile field capture and the
// supplier portal are deliberately NOT gated here — they're the product's
// actual differentiator and stay available from Starter up.
export type PlanFeature =
  | "accountingIntegrations" // Xero / QuickBooks / Sage sync
  | "invoiceAnomalyDetection"
  | "liveDashboard" // SSE-streamed real-time dashboard
  | "sso"; // OIDC/SAML

const PLAN_FEATURES: Record<Plan, Record<PlanFeature, boolean>> = {
  trial:      { accountingIntegrations: false, invoiceAnomalyDetection: false, liveDashboard: false, sso: false },
  starter:    { accountingIntegrations: false, invoiceAnomalyDetection: false, liveDashboard: false, sso: false },
  growth:     { accountingIntegrations: false, invoiceAnomalyDetection: false, liveDashboard: false, sso: false },
  enterprise: { accountingIntegrations: true,  invoiceAnomalyDetection: true,  liveDashboard: true,  sso: true  },
};

export function getLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[(plan as Plan) ?? "trial"] ?? PLAN_LIMITS.trial;
}

export function hasFeature(plan: string, feature: PlanFeature): boolean {
  return (PLAN_FEATURES[plan as Plan] ?? PLAN_FEATURES.trial)[feature];
}

/**
 * Route-level gate: fetches the org's plan and returns a 402 response if the
 * feature isn't included, or null if the caller should proceed. Returning
 * (rather than throwing) keeps this usable from routes that don't funnel
 * errors through handleRouteError().
 */
export async function requireFeature(orgId: string, feature: PlanFeature): Promise<NextResponse | null> {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
  const plan = (org?.plan ?? "trial") as Plan;
  if (hasFeature(plan, feature)) return null;
  return NextResponse.json(
    {
      code: "PLAN_UPGRADE_REQUIRED",
      message: `This feature requires the Enterprise plan. This organisation is on ${PLAN_LABELS[plan]}.`,
      details: { feature, plan },
    },
    { status: 402 },
  );
}

export function usagePercent(used: number, limit: number): number {
  if (limit === Infinity || limit === 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}
