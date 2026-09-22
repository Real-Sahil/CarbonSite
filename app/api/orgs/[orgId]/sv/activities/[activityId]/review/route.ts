export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { reviewSvActivitySchema } from "@/lib/validation/org";

type RouteContext = { params: Promise<{ orgId: string; activityId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId, activityId } = await params;
    const { session } = await requireOrgMember(
      orgId,
      "admin", "sustainability_director", "sustainability_manager", "reviewer",
    );

    const activity = await prisma.svActivity.findUnique({ where: { id: activityId } });
    if (!activity || activity.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Activity not found.", 404);
    }
    if (!["submitted", "under_review"].includes(activity.status)) {
      return apiError("CONFLICT", `Cannot review activity in status '${activity.status}'.`, 409);
    }

    const body = reviewSvActivitySchema.parse(await req.json());

    const updated = await prisma.svActivity.update({
      where: { id: activityId },
      data: {
        status: body.status,
        reviewNotes: body.reviewNotes,
        approvedByUserId: body.status === "approved" ? session.user.id : undefined,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: `sv_activity.${body.status}`,
      resourceType: "SvActivity",
      resourceId: activityId,
      metadata: { status: body.status, reviewNotes: body.reviewNotes },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
