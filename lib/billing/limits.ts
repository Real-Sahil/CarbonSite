import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getUsageSummary, type UsageEventType } from "./usage";

// Matches the pricing page's own "30-day free trial" language, and is what
// requireActiveBilling() below actually enforces against — see
// app/api/orgs/route.ts, where a new org's BillingSubscription row is
// created with trialEndsAt = now + this many days.
export const TRIAL_LENGTH_DAYS = 30;

export type Plan = "trial" | "starter" | "growth" | "enterprise";

export interface PlanLimits {
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
  growth:     { accountingIntegrations: true,  invoiceAnomalyDetection: false, liveDashboard: false, sso: false },
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
export const PLAN_ORDER = ["trial", "starter", "growth", "enterprise"] as const satisfies readonly Plan[];

function minimumPlanFor(feature: PlanFeature): Plan {
  return PLAN_ORDER.find((p) => PLAN_FEATURES[p][feature]) ?? "enterprise";
}

export async function requireFeature(orgId: string, feature: PlanFeature): Promise<NextResponse | null> {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
  const plan = (org?.plan ?? "trial") as Plan;
  if (hasFeature(plan, feature)) return null;
  const requiredPlan = minimumPlanFor(feature);
  return NextResponse.json(
    {
      code: "PLAN_UPGRADE_REQUIRED",
      message: `This feature requires the ${PLAN_LABELS[requiredPlan]} plan. This organisation is on ${PLAN_LABELS[plan]}.`,
      details: { feature, plan, requiredPlan },
    },
    { status: 402 },
  );
}

export function usagePercent(used: number, limit: number): number {
  if (limit === Infinity || limit === 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

/**
 * Blocks an org-scoped action once the trial has actually ended, or Stripe
 * has told us (via the subscription.deleted webhook) the paid subscription
 * is over. Enterprise is sales-assisted and never gated here. Previously
 * nothing checked this at all — trialEndsAt was computed and displayed on
 * the billing page but never enforced, so a trial org could use the
 * product indefinitely.
 */
export async function requireActiveBilling(orgId: string): Promise<NextResponse | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      plan: true,
      billingSubscription: { select: { status: true, trialEndsAt: true } },
    },
  });
  if (!org) return null; // let the caller's own not-found handling deal with this

  const plan = org.plan as Plan;
  if (plan === "enterprise") return null;

  const sub = org.billingSubscription;

  if (sub?.status === "canceled") {
    return NextResponse.json(
      {
        code: "SUBSCRIPTION_CANCELED",
        message: "This organisation's subscription has ended. Subscribe again to continue.",
      },
      { status: 402 },
    );
  }

  if (plan === "trial" && sub?.trialEndsAt && sub.trialEndsAt.getTime() < Date.now()) {
    return NextResponse.json(
      {
        code: "TRIAL_EXPIRED",
        message: "This organisation's trial has ended. Add a payment method and subscribe to continue.",
        details: { trialEndsAt: sub.trialEndsAt },
      },
      { status: 402 },
    );
  }

  return null;
}

// Only the four usage types that map to a single, unambiguous creation
// route are enforced here (see field-submissions, reports, imports/commit,
// calculation-runs routes). api.request has no single call site — gating
// it would mean middleware across every API route, a materially bigger
// change than gating the four creation actions above — and ocr.extraction
// happens on-device in the Flutter app (CLAUDE.md), never server-side, so
// there's nothing to gate here for it. Both are still recorded for the
// billing page's usage display; they're just not enforced against a cap.
const USAGE_EVENT_LIMIT_KEY: Partial<Record<UsageEventType, keyof PlanLimits>> = {
  "field_submission.submitted": "fieldSubmissionsPerMonth",
  "report.generated": "reportsPerMonth",
  "import.committed": "importsPerMonth",
  "calculation.run": "calculationRunsPerMonth",
};

/**
 * Route-level gate: blocks the action if this org has already used up its
 * plan's monthly allowance for eventType, or null if the caller should
 * proceed. Call this BEFORE creating the resource — recordUsage() (see
 * lib/billing/usage.ts) is called after, once the action actually
 * succeeds, so a blocked attempt is never counted.
 */
export async function requireWithinUsageLimit(orgId: string, eventType: UsageEventType): Promise<NextResponse | null> {
  const limitKey = USAGE_EVENT_LIMIT_KEY[eventType];
  if (!limitKey) return null; // not a metered/enforced event type

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      plan: true,
      billingSubscription: { select: { currentPeriodStart: true, currentPeriodEnd: true } },
    },
  });
  if (!org) return null;

  const limit = getLimits(org.plan)[limitKey];
  if (!isFinite(limit)) return null;

  const now = new Date();
  const periodStart = org.billingSubscription?.currentPeriodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = org.billingSubscription?.currentPeriodEnd ?? new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const summary = await getUsageSummary(orgId, periodStart, periodEnd);
  const used = summary[eventType] ?? 0;

  if (used >= limit) {
    const plan = (org.plan as Plan) ?? "trial";
    return NextResponse.json(
      {
        code: "USAGE_LIMIT_EXCEEDED",
        message: `This organisation has reached its ${PLAN_LABELS[plan] ?? plan} plan limit for this action this billing period (${limit.toLocaleString()}). Upgrade to continue.`,
        details: { eventType, limit, used },
      },
      { status: 402 },
    );
  }

  return null;
}
