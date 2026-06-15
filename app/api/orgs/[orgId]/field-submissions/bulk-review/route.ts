import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";

const bulkReviewSchema = z.discriminatedUnion("action", [
  z.object({
    ids: z.array(z.string().cuid()).min(1).max(100),
    action: z.literal("approve"),
    reviewNote: z.string().optional(),
  }),
  z.object({
    ids: z.array(z.string().cuid()).min(1).max(100),
    action: z.literal("reject"),
    reviewNote: z.string().optional(),
  }),
  z.object({
    ids: z.array(z.string().cuid()).min(1).max(100),
    action: z.literal("assign"),
    assigneeUserId: z.string(),
    reviewNote: z.string().optional(),
  }),
]);

type Params = { params: Promise<{ orgId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const body = bulkReviewSchema.parse(await req.json());

    const submissions = await prisma.fieldSubmission.findMany({
      where: {
        id: { in: body.ids },
        organizationId: orgId,
        status: { in: ["submitted", "under_review"] },
      },
      select: { id: true },
    });

    if (submissions.length === 0) {
      return apiError("NOT_FOUND", "No eligible submissions found.", 404);
    }

    const eligibleIds = submissions.map((s) => s.id);

    if (body.action === "assign") {
      await prisma.$transaction(async (tx) => {
        for (const submissionId of eligibleIds) {
          await tx.reviewTask.create({
            data: {
              organizationId: orgId,
              assigneeUserId: body.assigneeUserId,
              createdByUserId: session.user.id,
              type: "activity_record",
              targetId: submissionId,
              status: "open",
            },
          });
        }
      });

      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "field_submission.assigned",
        resourceType: "field_submission",
        resourceId: orgId,
        metadata: { action: "assign", assigneeUserId: body.assigneeUserId, count: eligibleIds.length, ids: eligibleIds },
      });

      return NextResponse.json({ updated: eligibleIds.length, ids: eligibleIds });
    }

    const status = body.action === "approve" ? "approved" : "rejected";
    const now = new Date();

    await prisma.$transaction(
      eligibleIds.map((id) =>
        prisma.fieldSubmission.update({
          where: { id },
          data: {
            status,
            reviewedByUserId: session.user.id,
            reviewedAt: now,
            ...(body.reviewNote ? { reviewNote: body.reviewNote } : {}),
          },
        }),
      ),
    );

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "field_submission.reviewed",
      resourceType: "field_submission",
      resourceId: orgId,
      metadata: { action: body.action, count: eligibleIds.length, ids: eligibleIds },
    });

    return NextResponse.json({ updated: eligibleIds.length, ids: eligibleIds });
  } catch (err) {
    return handleRouteError(err);
  }
}
