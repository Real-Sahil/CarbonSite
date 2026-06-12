import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createReviewTaskSchema } from "@/lib/validation/records";
import { enqueueNotification } from "@/lib/jobs/queues/index";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer");

    const url = new URL(req.url);
    const assigneeId = url.searchParams.get("assigneeId") ?? session.user.id;
    const status = url.searchParams.get("status") ?? "open";

    const tasks = await prisma.reviewTask.findMany({
      where: {
        organizationId: orgId,
        ...(assigneeId ? { assigneeUserId: assigneeId } : {}),
        status: status as never,
      },
      include: {
        assignee: { select: { name: true, email: true } },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ data: tasks });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const body = createReviewTaskSchema.parse(await req.json());

    // Verify assignee is a member
    const membership = await prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: body.assigneeUserId } },
      select: { id: true },
    });
    if (!membership) {
      return apiError("NOT_FOUND", "Assignee is not a member of this organisation.", 404);
    }

    const task = await prisma.reviewTask.create({
      data: {
        organizationId: orgId,
        type: body.type,
        targetId: body.targetId,
        assigneeUserId: body.assigneeUserId,
        createdByUserId: session.user.id,
        status: "open",
      },
      include: {
        assignee: { select: { name: true, email: true } },
        createdBy: { select: { name: true, email: true } },
      },
    });

    // Notify assignee (fire-and-forget — don't fail the request if enqueue fails)
    enqueueNotification({
      type: "task_assigned",
      recipientUserId: body.assigneeUserId,
      orgId,
      resourceId: task.id,
      metadata: { targetLabel: body.targetId },
    }).catch((err) => console.error("[review-tasks] Failed to enqueue notification:", err));

    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
