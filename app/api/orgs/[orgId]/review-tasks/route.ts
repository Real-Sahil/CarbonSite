import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { dispatchNotification } from "@/lib/jobs/dispatch";
import { resolveReviewTarget } from "@/lib/review-tasks/targets";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createReviewTaskSchema } from "@/lib/validation/org";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<unknown> },
) {
  try {
    const { orgId } = (await params) as { orgId: string };
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");
    const limited = rateLimit(req, {
      key: rateLimitKey(orgId, "review-tasks", session.user.id),
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createReviewTaskSchema.parse(await req.json());
    const target = await resolveReviewTarget({
      organizationId: orgId,
      type: body.type,
      targetId: body.targetId,
    });
    if (!target) {
      return apiError("REVIEW_TARGET_NOT_FOUND", "Review task target was not found.", 404);
    }

    const assignee = await prisma.organizationMembership.findFirst({
      where: {
        organizationId: orgId,
        userId: body.assigneeUserId,
        role: { in: ["admin", "editor", "reviewer"] },
      },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!assignee) {
      return apiError(
        "REVIEW_ASSIGNEE_NOT_ALLOWED",
        "Assignee must be an admin, editor, or reviewer in this organisation.",
        400,
      );
    }

    const existing = await prisma.reviewTask.findFirst({
      where: {
        organizationId: orgId,
        type: body.type,
        targetId: body.targetId,
        assigneeUserId: body.assigneeUserId,
        status: "open",
      },
    });
    if (existing) return NextResponse.json(existing);

    const task = await prisma.reviewTask.create({
      data: {
        organizationId: orgId,
        type: body.type,
        targetId: body.targetId,
        assigneeUserId: body.assigneeUserId,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "review_task.assigned",
      resourceType: body.type,
      resourceId: body.targetId,
      metadata: {
        taskId: task.id,
        assigneeUserId: body.assigneeUserId,
      },
    });

    await dispatchNotification({
      type: "task_assigned",
      recipientUserId: body.assigneeUserId,
      orgId,
      resourceId: task.id,
      metadata: {
        orgId,
        taskId: task.id,
        targetType: body.type,
        targetId: body.targetId,
        targetLabel: target.label,
        targetDetail: target.detail,
        targetHref: target.href,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
