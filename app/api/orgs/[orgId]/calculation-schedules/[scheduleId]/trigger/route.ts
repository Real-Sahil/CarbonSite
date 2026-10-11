export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { triggerSchedule } from "@/lib/scheduling/calculation-scheduler";
import { writeAuditLog } from "@/lib/db/audit";

type Params = { params: Promise<{ orgId: string; scheduleId: string }> };

/**
 * POST /api/orgs/[orgId]/calculation-schedules/[scheduleId]/trigger
 * Immediately fires a calculation run for this schedule, regardless of
 * its next scheduled time. Admins/editors only.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, scheduleId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const { calculationRunId } = await triggerSchedule(scheduleId, orgId, session.user.id);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "calculation.schedule_manually_triggered",
      resourceType: "calculation_run",
      resourceId: calculationRunId,
      metadata: { scheduleId },
    });

    return NextResponse.json({ calculationRunId }, { status: 202 });
  } catch (err) {
    return handleRouteError(err);
  }
}
