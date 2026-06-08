import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createCommentSchema } from "@/lib/validation/org";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<unknown> },
) {
  try {
    const { orgId } = (await params) as { orgId: string };
    const { session } = await requireOrgMember(
      orgId,
      "admin",
      "editor",
      "reviewer",
      "auditor",
    );
    const body = createCommentSchema.parse(await req.json());

    const targetExists = await commentTargetExists({
      organizationId: orgId,
      targetType: body.targetType,
      targetId: body.targetId,
    });
    if (!targetExists) {
      return apiError("COMMENT_TARGET_NOT_FOUND", "Comment target was not found.", 404);
    }

    const comment = await prisma.comment.create({
      data: {
        organizationId: orgId,
        targetType: body.targetType,
        targetId: body.targetId,
        body: body.body,
        authorUserId: session.user.id,
      },
      include: {
        author: { select: { name: true, email: true } },
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "comment.created",
      resourceType: body.targetType,
      resourceId: body.targetId,
      metadata: {
        commentId: comment.id,
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

async function commentTargetExists({
  organizationId,
  targetType,
  targetId,
}: {
  organizationId: string;
  targetType: string;
  targetId: string;
}) {
  if (targetType === "field_submission") {
    return Boolean(
      await prisma.fieldSubmission.findFirst({
        where: { id: targetId, organizationId },
        select: { id: true },
      }),
    );
  }
  if (targetType === "activity_record") {
    return Boolean(
      await prisma.activityRecord.findFirst({
        where: { id: targetId, organizationId },
        select: { id: true },
      }),
    );
  }
  if (targetType === "import_batch") {
    return Boolean(
      await prisma.importBatch.findFirst({
        where: { id: targetId, organizationId },
        select: { id: true },
      }),
    );
  }
  if (targetType === "report") {
    return Boolean(
      await prisma.report.findFirst({
        where: { id: targetId, organizationId },
        select: { id: true },
      }),
    );
  }
  if (targetType === "initiative") {
    return Boolean(
      await prisma.reductionInitiative.findFirst({
        where: { id: targetId, organizationId },
        select: { id: true },
      }),
    );
  }
  return false;
}
