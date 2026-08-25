export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

// Onboarding steps with metadata
const ONBOARDING_STEPS = {
  invite_team: {
    title: "Invite your team",
    description: "Add team members who will help manage emissions data",
    required: false,
  },
  set_reporting_period: {
    title: "Set up reporting period",
    description: "Define the time frame for your emissions inventory",
    required: true,
  },
  add_emission_categories: {
    title: "Add emission categories",
    description: "Select which scopes and categories apply to your business",
    required: true,
  },
  import_activity_data: {
    title: "Import activity data",
    description: "Upload CSV or connect to your data source (Xero, etc)",
    required: false,
  },
  review_calculations: {
    title: "Run calculations",
    description: "Generate your first emissions report",
    required: false,
  },
} as const;

type StepKey = keyof typeof ONBOARDING_STEPS;

interface StepState {
  [key: string]: {
    completed: boolean;
    skipped: boolean;
    completedAt?: string;
  };
}

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    let progress = await prisma.onboardingProgress.findUnique({
      where: { organizationId: orgId },
    });

    // Create default onboarding record if it doesn't exist
    if (!progress) {
      progress = await prisma.onboardingProgress.create({
        data: {
          organizationId: orgId,
          stepState: {},
          state: "not_started",
        },
      });
    }

    const stepState = (progress.stepState || {}) as StepState;

    // Build response with step details
    const steps = Object.entries(ONBOARDING_STEPS).map(([key, meta]) => ({
      key,
      ...meta,
      ...stepState[key],
      completed: stepState[key]?.completed ?? false,
      skipped: stepState[key]?.skipped ?? false,
    }));

    const completedCount = steps.filter((s) => s.completed).length;
    const progress_percent = Math.round((completedCount / steps.length) * 100);

    return NextResponse.json({
      state: progress.state,
      progress_percent,
      steps,
      completedAt: progress.completedAt,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

const updateSchema = z.object({
  step: z.enum(Object.keys(ONBOARDING_STEPS) as [StepKey, ...StepKey[]]),
  completed: z.boolean().optional(),
  skipped: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const body = updateSchema.parse(await req.json());
    const { step, completed, skipped } = body;

    let progress = await prisma.onboardingProgress.findUnique({
      where: { organizationId: orgId },
    });

    if (!progress) {
      progress = await prisma.onboardingProgress.create({
        data: {
          organizationId: orgId,
          stepState: {},
          state: "not_started",
        },
      });
    }

    const stepState = (progress.stepState || {}) as StepState;

    // Update the step state
    stepState[step] = {
      ...stepState[step],
      completed: completed ?? stepState[step]?.completed ?? false,
      skipped: skipped ?? stepState[step]?.skipped ?? false,
    };

    if (completed) {
      stepState[step].completedAt = new Date().toISOString();
    }

    // Check if all required steps are complete
    const requiredSteps = Object.entries(ONBOARDING_STEPS)
      .filter(([, meta]) => meta.required)
      .map(([key]) => key);

    const allRequiredComplete = requiredSteps.every(
      (s) => stepState[s]?.completed
    );

    const newState = allRequiredComplete ? "completed" : "in_progress";

    progress = await prisma.onboardingProgress.update({
      where: { organizationId: orgId },
      data: {
        stepState,
        state: newState,
        completedAt: allRequiredComplete ? new Date() : null,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "onboarding.step_completed",
      resourceType: "OnboardingProgress",
      resourceId: orgId,
      metadata: { step, completed, skipped },
    });

    return NextResponse.json({ state: progress.state, step });
  } catch (err) {
    return handleRouteError(err);
  }
}
