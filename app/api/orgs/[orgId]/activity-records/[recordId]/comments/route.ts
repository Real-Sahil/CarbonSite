import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createCommentSchema } from "@/lib/validation/records";

type Params = { params: Promise<{ orgId: string; recordId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const record = await prisma.activityRecord.findUnique({
      where: { id: recordId },
      select: { organizationId: true },
    });
    if (!record || record.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Activity record not found.", 404);
    }

    const comments = await prisma.comment.findMany({
      where: { organizationId: orgId, targetType: "activity_record", targetId: recordId },
      include: { author: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ data: comments });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const record = await prisma.activityRecord.findUnique({
      where: { id: recordId },
      select: { organizationId: true },
    });
    if (!record || record.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Activity record not found.", 404);
    }

    const body = createCommentSchema.parse(await req.json());

    const comment = await prisma.comment.create({
      data: {
        organizationId: orgId,
        targetType: "activity_record",
        targetId: recordId,
        body: body.body,
        authorUserId: session.user.id,
      },
      include: { author: { select: { name: true, email: true } } },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
