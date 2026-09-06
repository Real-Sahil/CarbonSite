export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { dispatchNotification } from "@/lib/jobs/dispatch";
import {
  approvalBlocker,
  approveSubmissionInTx,
} from "@/lib/field-submissions/approve";
import { scheduleCalculationForPeriod } from "@/lib/field-submissions/trigger-calculation";

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
      include: { files: { select: { evidenceFileId: true } } },
    });

    if (submissions.length === 0) {
      return apiError("NOT_FOUND", "No eligible submissions found.", 404);
    }

    if (body.action === "assign") {
      const assignee = await prisma.organizationMembership.findUnique({
        where: {
          organizationId_userId: { organizationId: orgId, userId: body.assigneeUserId },
        },
        select: { userId: true },
      });
      if (!assignee) {
        return apiError("INVALID_ASSIGNEE", "Assignee is not a member of this organisation.", 422);
      }

      await prisma.$transaction(async (tx) => {
        for (const submission of submissions) {
          await tx.reviewTask.create({
            data: {
              organizationId: orgId,
              assigneeUserId: body.assigneeUserId,
              createdByUserId: session.user.id,
              type: "field_submission",
              targetId: submission.id,
              status: "open",
            },
          });
        }
      });

      for (const submission of submissions) {
        await writeAuditLog({
          organizationId: orgId,
          actorUserId: session.user.id,
          action: "field_submission.assigned",
          resourceType: "field_submission",
          resourceId: submission.id,
          metadata: { assigneeUserId: body.assigneeUserId },
        });
      }

      return NextResponse.json({
        updated: submissions.length,
        ids: submissions.map((s) => s.id),
      });
    }

    if (body.action === "approve") {
      // A submission can only be bulk-approved when it already carries an
      // emission category (assigned at triage) and valid amount data —
      // otherwise the resulting ActivityRecord could not be calculated.
      const approved: string[] = [];
      const skipped: { id: string; reason: string }[] = [];
      const notifiable: { submissionId: string; recipientUserId: string; activityRecordId: string | null }[] = [];

      for (const submission of submissions) {
        const blocker = approvalBlocker(submission, submission.emissionCategoryId, submission.facilityId);
        if (blocker) {
          skipped.push({ id: submission.id, reason: blocker.message });
          continue;
        }
        const result = await prisma.$transaction((tx) =>
          approveSubmissionInTx(tx, {
            orgId,
            submission,
            emissionCategoryId: submission.emissionCategoryId,
            reviewerUserId: session.user.id,
            reviewNote: body.reviewNote,
          }),
        );
        approved.push(submission.id);
        notifiable.push({
          submissionId: submission.id,
          recipientUserId: submission.submittedByUserId,
          activityRecordId: result.activityRecordId,
        });
        await writeAuditLog({
          organizationId: orgId,
          actorUserId: session.user.id,
          action: "field_submission.reviewed",
          resourceType: "field_submission",
          resourceId: submission.id,
          metadata: { action: "approved", activityRecordId: result.activityRecordId, bulk: true },
        });
        await writeAuditLog({
          organizationId: orgId,
          actorUserId: session.user.id,
          action: "record.created",
          resourceType: result.activityRecordId ? "activity_record" : "water_record",
          resourceId: result.activityRecordId ?? submission.id,
          metadata: { fromFieldSubmission: submission.id, bulk: true },
        });
      }

      for (const entry of notifiable) {
        dispatchNotification({
          type: "submission_reviewed",
          recipientUserId: entry.recipientUserId,
          orgId,
          resourceId: entry.submissionId,
          metadata: { orgId, status: "approved", activityRecordId: entry.activityRecordId },
        }).catch((err) =>
          console.error("[field-submissions] bulk approve notification failed:", err),
        );
      }

      if (approved.length === 0) {
        return apiError(
          "NOTHING_APPROVED",
          "No submissions could be approved. Assign emission categories and valid amounts first.",
          422,
        );
      }

      // Auto-trigger a calculation run for each distinct reporting period that
      // received at least one newly approved submission.
      const approvedPeriods = new Set(
        submissions
          .filter((s) => approved.includes(s.id))
          .map((s) => s.reportingPeriodId),
      );
      for (const periodId of approvedPeriods) {
        scheduleCalculationForPeriod(orgId, periodId, session.user.id).catch((err) =>
          console.error("[field-submissions] bulk auto-calc schedule failed:", err),
        );
      }

      return NextResponse.json({ updated: approved.length, ids: approved, skipped });
    }

    // reject
    const now = new Date();
    await prisma.$transaction(
      submissions.map((submission) =>
        prisma.fieldSubmission.update({
          where: { id: submission.id },
          data: {
            status: "rejected",
            reviewedByUserId: session.user.id,
            reviewedAt: now,
            ...(body.reviewNote ? { reviewNote: body.reviewNote } : {}),
          },
        }),
      ),
    );

    for (const submission of submissions) {
      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "field_submission.reviewed",
        resourceType: "field_submission",
        resourceId: submission.id,
        metadata: { action: "rejected", bulk: true },
      });
      dispatchNotification({
        type: "submission_reviewed",
        recipientUserId: submission.submittedByUserId,
        orgId,
        resourceId: submission.id,
        metadata: { orgId, status: "rejected" },
      }).catch((err) =>
        console.error("[field-submissions] bulk reject notification failed:", err),
      );
    }

    return NextResponse.json({
      updated: submissions.length,
      ids: submissions.map((s) => s.id),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
