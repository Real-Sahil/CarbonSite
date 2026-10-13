export const dynamic = "force-dynamic";

import { firstEvidenceMismatch, sealAfterApproval } from "@/lib/evidence/seal";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { dispatchNotification } from "@/lib/jobs/dispatch";
import { SocialValueApprovalError } from "@/lib/social-value/field-capture";
import {
  approvalBlocker,
  approveSubmissionInTx,
  SubmissionAlreadyDecidedError,
} from "@/lib/field-submissions/approve";
import { scheduleCalculationForPeriod } from "@/lib/field-submissions/trigger-calculation";
import { orgRefsError } from "@/lib/security/org-refs";

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
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.reviewersAndEditors);

    const body = bulkReviewSchema.parse(await req.json());
    const refError = await orgRefsError(orgId, { assigneeUserId: body.action === "assign" ? body.assigneeUserId : undefined });
    if (refError) return refError;

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
        select: { role: true },
      });
      if (!assignee) {
        return apiError("INVALID_ASSIGNEE", "Assignee is not a member of this organisation.", 422);
      }
      // A review task only means something to a role that can review; anyone else would hold it unseen.
      if (!ROLE_GROUPS.reviewersAndEditors.includes(assignee.role)) {
        return apiError("INVALID_ASSIGNEE", "Assignee must be a member who can review submissions.", 422);
      }

      // A submission with an open review task keeps it; moving it to someone else is a separate decision.
      const open = await prisma.reviewTask.findMany({
        where: {
          organizationId: orgId,
          type: "field_submission",
          status: "open",
          targetId: { in: submissions.map((s) => s.id) },
        },
        select: { targetId: true },
      });
      const alreadyOpen = new Set(open.map((task) => task.targetId));
      const toAssign = submissions.filter((s) => !alreadyOpen.has(s.id));
      const skipped = submissions
        .filter((s) => alreadyOpen.has(s.id))
        .map((s) => ({ id: s.id, reason: "Already has an open review task." }));

      await prisma.$transaction(async (tx) => {
        for (const submission of toAssign) {
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

      for (const submission of toAssign) {
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
        updated: toAssign.length,
        ids: toAssign.map((s) => s.id),
        skipped,
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
        // Each row commits on its own: a row that fails is skipped and the others still go through.
        let result;
        try {
          const changedFile = await firstEvidenceMismatch(orgId, submission.files.map((f) => f.evidenceFileId));
          if (changedFile) {
            skipped.push({ id: submission.id, reason: "An evidence file no longer matches its recorded SHA-256." });
            continue;
          }
          const blocker = approvalBlocker(submission, submission.emissionCategoryId, submission.facilityId);
          if (blocker) {
            skipped.push({ id: submission.id, reason: blocker.message });
            continue;
          }
          result = await prisma.$transaction((tx) =>
            approveSubmissionInTx(tx, {
              orgId,
              submission,
              emissionCategoryId: submission.emissionCategoryId,
              reviewerUserId: session.user.id,
              reviewNote: body.reviewNote,
              origin: req.nextUrl.origin,
            }),
          );
        } catch (err) {
          if (err instanceof SocialValueApprovalError || err instanceof SubmissionAlreadyDecidedError) {
            skipped.push({ id: submission.id, reason: err.message });
          } else {
            console.error("[field-submissions] bulk approve failed for", submission.id, err);
            skipped.push({ id: submission.id, reason: "Could not be approved. Try again." });
          }
          continue;
        }
        approved.push(submission.id);
        notifiable.push({
          submissionId: submission.id,
          recipientUserId: submission.submittedByUserId,
          activityRecordId: result.activityRecordId,
        });
        // The row is committed, so it stays in the approved list even if its seal or audit entry fails.
        try {
          await sealAfterApproval(orgId, result.activityRecordId, submission.id, session.user.id);
          await writeAuditLog({
            organizationId: orgId,
            actorUserId: session.user.id,
            action: "field_submission.reviewed",
            resourceType: "field_submission",
            resourceId: submission.id,
            metadata: {
              action: "approved",
              activityRecordId: result.activityRecordId,
              bulk: true,
              ...(result.embodied
                ? result.embodied.recordId
                  ? { embodiedCarbonRecordId: result.embodied.recordId }
                  : { embodiedNotRecorded: "reason" in result.embodied ? result.embodied.reason : null }
                : {}),
            },
          });
          await writeAuditLog({
            organizationId: orgId,
            actorUserId: session.user.id,
            action: result.fuel ? "fuel.entry_added" : result.svActivityId ? "sv_activity.create" : "record.created",
            resourceType: result.fuel ? `fuel_${result.fuel.kind}` : result.svActivityId ? "sv_activity" : result.activityRecordId ? "activity_record" : "water_record",
            resourceId: result.fuel?.fuelEntryId ?? result.svActivityId ?? result.activityRecordId ?? submission.id,
            metadata: { fromFieldSubmission: submission.id, bulk: true },
          });
        } catch (err) {
          console.error("[field-submissions] bulk approve seal or audit failed for", submission.id, err);
        }
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
    // Guarded like the approval claim: a row another review decided first is reported as skipped, not overwritten.
    const outcomes = await prisma.$transaction(
      submissions.map((submission) =>
        prisma.fieldSubmission.updateMany({
          where: { id: submission.id, organizationId: orgId, status: { notIn: ["approved", "rejected"] } },
          data: {
            status: "rejected",
            reviewedByUserId: session.user.id,
            reviewedAt: now,
            ...(body.reviewNote ? { reviewNote: body.reviewNote } : {}),
          },
        }),
      ),
    );
    const rejected = submissions.filter((_, i) => outcomes[i].count === 1);
    const resolved = submissions.filter((_, i) => outcomes[i].count === 0);

    for (const submission of rejected) {
      try {
        await writeAuditLog({
          organizationId: orgId,
          actorUserId: session.user.id,
          action: "field_submission.reviewed",
          resourceType: "field_submission",
          resourceId: submission.id,
          metadata: { action: "rejected", bulk: true },
        });
      } catch (err) {
        console.error("[field-submissions] bulk reject audit failed for", submission.id, err);
      }
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
      updated: rejected.length,
      ids: rejected.map((s) => s.id),
      skipped: resolved.map((s) => ({ id: s.id, reason: "Submission is already resolved." })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
