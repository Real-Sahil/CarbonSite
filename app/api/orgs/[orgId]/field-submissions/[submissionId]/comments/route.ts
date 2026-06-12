import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createCommentSchema } from "@/lib/validation/records";

type Params = { params: Promise<{ orgId: string; submissionId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, submissionId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const submission = await prisma.fieldSubmission.findUnique({
      where: { id: submissionId },
      select: { organizationId: true },
    });
    if (!submission || submission.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Submission not found.", 404);
    }

    const body = createCommentSchema.parse(await req.json());

    const comment = await prisma.comment.create({
      data: {
        organizationId: orgId,
        targetType: "field_submission",
        targetId: submissionId,
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
