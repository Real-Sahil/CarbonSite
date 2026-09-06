import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

export const ONBOARDING_STEPS = [
  "org_profile",
  "first_team_member",
  "reporting_period",
  "first_import",
  "first_calculation",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

const completeStepSchema = z.union([
  z.object({ step: z.enum(ONBOARDING_STEPS) }),
  z.object({ skipAll: z.literal(true) }),
]);

// GET /api/orgs/:orgId/onboarding — fetch step completion state
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId);

    // Derive which steps are actually satisfied from live DB state
    const [
      org,
      memberCount,
      periodCount,
      activityCount,
      calcCount,
      savedProgress,
    ] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true, industry: true, hqCountry: true },
      }),
      prisma.organizationMembership.count({ where: { organizationId: orgId } }),
      prisma.reportingPeriod.count({ where: { organizationId: orgId } }),
      prisma.activityRecord.count({ where: { organizationId: orgId } }),
      prisma.calculationRun.count({ where: { organizationId: orgId } }),
      prisma.onboardingProgress.findUnique({
        where: { organizationId: orgId },
        select: { completedSteps: true, isComplete: true },
      }),
    ]);

    // Derive completion from actual state so it stays accurate even if
    // steps were completed outside the wizard (e.g. via CSV import).
    const derived: Record<OnboardingStepId, boolean> = {
      org_profile: !!(org?.industry && org?.hqCountry),
      first_team_member: memberCount >= 2,
      reporting_period: periodCount >= 1,
      first_import: activityCount >= 1,
      first_calculation: calcCount >= 1,
    };

    // Merge saved progress (manually skipped/dismissed steps) with derived.
    const saved = new Set(savedProgress?.completedSteps ?? []);
    const steps = ONBOARDING_STEPS.map((id) => ({
      id,
      done: derived[id] || saved.has(id),
    }));

    const isComplete = steps.every((s) => s.done);

    void session; // not used here but keeps the auth check meaningful
    return NextResponse.json({ steps, isComplete });
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/orgs/:orgId/onboarding — mark a step complete (or mark all done)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session, membership } = await requireOrgMember(orgId, "admin");

    const body = await req.json().catch(() => ({}));
    const parsed = completeStepSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("INVALID_INPUT", "Invalid step", 400, parsed.error.flatten());
    }

    // skipAll marks the whole wizard as complete so the dashboard redirect doesn't fire.
    const isSkipAll = "skipAll" in parsed.data && parsed.data.skipAll === true;

    const existing = await prisma.onboardingProgress.findUnique({
      where: { organizationId: orgId },
      select: { completedSteps: true },
    });

    const current = new Set(existing?.completedSteps ?? []);
    if (isSkipAll) {
      ONBOARDING_STEPS.forEach((s) => current.add(s));
    } else {
      current.add((parsed.data as { step: string }).step);
    }
    const completedSteps = [...current];
    const isComplete = ONBOARDING_STEPS.every((s) => current.has(s));

    const progress = await prisma.onboardingProgress.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        completedSteps,
        isComplete,
        completedAt: isComplete ? new Date() : null,
      },
      update: {
        completedSteps,
        isComplete,
        completedAt: isComplete ? new Date() : undefined,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "onboarding.step_completed",
      resourceType: "onboarding_progress",
      resourceId: progress.id,
      metadata: { step: isSkipAll ? "skip_all" : (parsed.data as { step: string }).step, isComplete },
    });

    void membership;
    return NextResponse.json({ steps: completedSteps, isComplete });
  } catch (err) {
    return handleRouteError(err);
  }
}
