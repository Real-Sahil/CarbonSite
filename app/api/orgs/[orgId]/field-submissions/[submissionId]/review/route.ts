import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { reviewFieldSubmissionSchema } from "@/lib/validation/records";
import { dispatchNotification } from "@/lib/jobs/dispatch";
import {
  approvalBlocker,
  approveSubmissionInTx,
} from "@/lib/field-submissions/approve";

type Params = { params: Promise<{ orgId: string; submissionId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, submissionId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const submission = await prisma.fieldSubmission.findFirst({
      where: { id: submissionId, organizationId: orgId },
      include: { files: { select: { evidenceFileId: true } } },
    });
    if (!submission) {
      return apiError("NOT_FOUND", "Submission not found.", 404);
    }
    if (submission.status === "approved" || submission.status === "rejected") {
      return apiError("CONFLICT", "Submission is already resolved.", 409);
    }

    const body = reviewFieldSubmissionSchema.parse(await req.json());

    if (body.facilityId) {
      const facility = await prisma.facility.findFirst({
        where: { id: body.facilityId, organizationId: orgId },
        select: { id: true },
      });
      if (!facility) {
        return apiError("INVALID_FACILITY", "Facility does not belong to this organisation.", 422);
      }
    }

    let activityRecordId: string | null = null;
    let updated;

    if (body.action === "approved") {
      const emissionCategoryId = body.emissionCategoryId ?? submission.emissionCategoryId;
      const blocker = approvalBlocker(submission, emissionCategoryId);
      if (blocker) {
        return apiError(blocker.code, blocker.message, 422);
      }
      const category = await prisma.emissionCategory.findUnique({
        where: { id: emissionCategoryId! },
        select: { id: true },
      });
      if (!category) {
        return apiError("INVALID_EMISSION_CATEGORY", "Emission category does not exist.", 422);
      }

      const submissionWithEdits = {
        ...submission,
        ...(body.ocrExtractedData ? { ocrExtractedData: body.ocrExtractedData } : {}),
        ...(body.formData ? { formData: body.formData } : {}),
      };

      const result = await prisma.$transaction(async (tx) => {
        if (body.ocrExtractedData || body.formData) {
          await tx.fieldSubmission.update({
            where: { id: submissionId },
            data: {
              ...(body.ocrExtractedData ? { ocrExtractedData: body.ocrExtractedData } : {}),
              ...(body.formData ? { formData: body.formData } : {}),
            },
          });
        }
        return approveSubmissionInTx(tx, {
          orgId,
          submission: submissionWithEdits,
          emissionCategoryId: emissionCategoryId!,
          facilityId: body.facilityId,
          reviewerUserId: session.user.id,
          reviewNote: body.reviewNote,
        });
      });
      activityRecordId = result.activityRecordId;
      updated = result.submission;

      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "record.created",
        resourceType: "activity_record",
        resourceId: activityRecordId!,
        metadata: { fromFieldSubmission: submissionId },
      });
    } else {
      updated = await prisma.fieldSubmission.update({
        where: { id: submissionId },
        data: {
          status: body.action,
          reviewedByUserId: session.user.id,
          reviewedAt: new Date(),
          reviewNote: body.reviewNote,
          ...(body.emissionCategoryId ? { emissionCategoryId: body.emissionCategoryId } : {}),
          ...(body.facilityId ? { facilityId: body.facilityId } : {}),
          ...(body.ocrExtractedData ? { ocrExtractedData: body.ocrExtractedData } : {}),
          ...(body.formData ? { formData: body.formData } : {}),
        },
      });
    }

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "field_submission.reviewed",
      resourceType: "field_submission",
      resourceId: submissionId,
      metadata: { action: body.action, activityRecordId },
    });

    // Notify the field worker of the review outcome. dispatchNotification is
    // inline-mode aware — enqueueNotification alone never delivers when no
    // separate worker process is running (the default deployment).
    dispatchNotification({
      type: "submission_reviewed",
      recipientUserId: submission.submittedByUserId,
      orgId,
      resourceId: submissionId,
      metadata: { orgId, status: body.action, activityRecordId },
    }).catch((err) =>
      console.error("[field-submissions] Failed to dispatch review notification:", err),
    );

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
