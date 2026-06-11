import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { updateReviewTaskSchema } from "@/lib/validation/org";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<unknown> },
) {
  try {
    const { orgId, taskId } = (await params) as { orgId: string; taskId: string };
    const { session, membership } = await requireOrgMember(
      orgId,
      "admin",
      "editor",
      "reviewer",
    );
    const limited = rateLimit(req, {
      key: rateLimitKey(orgId, "review-task-update", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = updateReviewTaskSchema.parse(await req.json());
    const task = await prisma.reviewTask.findFirst({
      where: { id: taskId, organizationId: orgId },
    });
    if (!task) {
      return apiError("REVIEW_TASK_NOT_FOUND", "Review task was not found.", 404);
    }

    const canUpdateAny = membership.role === "admin" || membership.role === "editor";
    if (!canUpdateAny && task.assigneeUserId !== session.user.id) {
      return apiError(
        "REVIEW_TASK_FORBIDDEN",
        "Only the assignee, admins, or editors can update this review task.",
        403,
      );
    }

    const updated = await prisma.reviewTask.update({
      where: { id: task.id },
      data: { status: body.status },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "review_task.status_changed",
      resourceType: task.type,
      resourceId: task.targetId,
      metadata: {
        taskId: task.id,
        previousStatus: task.status,
        newStatus: body.status,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
