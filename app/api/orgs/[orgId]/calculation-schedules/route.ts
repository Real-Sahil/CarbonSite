import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { getSession } from "@/lib/auth/session";
import {
  createCalculationSchedule,
  getCalculationSchedules,
  triggerCalculation,
  getScheduleStats,
} from "@/lib/scheduling/calculation-scheduler";
import { z } from "zod";

const createScheduleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  reportingPeriodId: z.string(),
  schedule: z.enum(["manual", "weekly", "monthly", "quarterly", "annually"]),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  quarterMonth: z.number().refine((v) => [1, 4, 7, 10].includes(v)).optional(),
});

const triggerSchema = z.object({
  reportingPeriodId: z.string(),
});

/**
 * GET /api/orgs/[orgId]/calculation-schedules
 * List calculation schedules for organization.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const schedules = await getCalculationSchedules(orgId);
    const stats = await getScheduleStats(orgId);

    return NextResponse.json({
      schedules: schedules.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        schedule: s.schedule,
        enabled: s.enabled,
        nextRun: s.nextRun,
        lastRun: s.lastRun,
      })),
      stats,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * POST /api/orgs/[orgId]/calculation-schedules
 * Create a new calculation schedule.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await getSession();

    if (!session?.user?.id) {
      return apiError("UNAUTHORIZED", "Not authenticated", 401);
    }

    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const body = createScheduleSchema.parse(await request.json());

    const schedule = await createCalculationSchedule(
      orgId,
      body,
      session.user.id
    );

    return NextResponse.json(
      {
        id: schedule.id,
        name: schedule.name,
        description: schedule.description,
        schedule: schedule.schedule,
        enabled: schedule.enabled,
        nextRun: schedule.nextRun,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
