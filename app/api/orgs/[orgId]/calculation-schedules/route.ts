import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import {
  createCalculationSchedule,
  getCalculationSchedules,
  getScheduleStats,
} from "@/lib/scheduling/calculation-scheduler";
import { z } from "zod";

const createScheduleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  reportingPeriodId: z.string().min(1),
  frequency: z.enum(["manual", "weekly", "monthly", "quarterly", "annually"]),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  quarterMonth: z.number().int().refine((v) => [1, 4, 7, 10].includes(v)).optional(),
});

/**
 * GET /api/orgs/[orgId]/calculation-schedules
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const [schedules, stats] = await Promise.all([
      getCalculationSchedules(orgId),
      getScheduleStats(orgId),
    ]);

    return NextResponse.json({
      schedules: schedules.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        frequency: s.frequency,
        enabled: s.enabled,
        nextRunAt: s.nextRunAt,
        lastRunAt: s.lastRunAt,
        reportingPeriodId: s.reportingPeriodId,
      })),
      stats,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * POST /api/orgs/[orgId]/calculation-schedules — create a new schedule
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const body = createScheduleSchema.parse(await request.json());

    const schedule = await createCalculationSchedule(orgId, body, session.user.id);

    return NextResponse.json(
      {
        id: schedule.id,
        name: schedule.name,
        description: schedule.description,
        frequency: schedule.frequency,
        enabled: schedule.enabled,
        nextRunAt: schedule.nextRunAt,
        reportingPeriodId: schedule.reportingPeriodId,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
