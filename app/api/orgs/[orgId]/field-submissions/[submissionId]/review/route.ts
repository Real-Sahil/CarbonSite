export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { reviewFieldSubmissionSchema } from "@/lib/validation/records";
import { dispatchNotification } from "@/lib/jobs/dispatch";
import { enqueueSupplierPerformanceUpdate } from "@/lib/jobs/queues/index";
import {
  approvalBlocker,
  approveSubmissionInTx,
} from "@/lib/field-submissions/approve";
import { scheduleCalculationForPeriod } from "@/lib/field-submissions/trigger-calculation";

type Params = { params: Promise<{ orgId: string; submissionId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, submissionId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const submission = await prisma.fieldSubmission.findFirst({
      where: { id: submissionId, organizationId: orgId },
      include: { files: { select: { evidenceFileId: true } } },
      // ocrExtractedData is included by default (no select exclusion)
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
      const resolvedFacilityId = body.facilityId ?? submission.facilityId;
      const blocker = approvalBlocker(submission, emissionCategoryId, resolvedFacilityId);
      if (blocker) {
        return apiError(blocker.code, blocker.message, 422);
      }
      // Water meter readings promote to a WaterRecord, not an
      // ActivityRecord — they never carry an EmissionCategory.
      if (submission.documentType !== "water_meter_reading") {
        const category = await prisma.emissionCategory.findUnique({
          where: { id: emissionCategoryId! },
          select: { id: true },
        });
        if (!category) {
          return apiError("INVALID_EMISSION_CATEGORY", "Emission category does not exist.", 422);
        }
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
          emissionCategoryId: emissionCategoryId ?? null,
          facilityId: body.facilityId,
          reviewerUserId: session.user.id,
          reviewNote: body.reviewNote,
        });
      });
      activityRecordId = result.activityRecordId;
      updated = result.submission;

      if (activityRecordId) {
        await writeAuditLog({
          organizationId: orgId,
          actorUserId: session.user.id,
          action: "record.created",
          resourceType: "activity_record",
          resourceId: activityRecordId,
          metadata: { fromFieldSubmission: submissionId },
        });
      } else {
        await writeAuditLog({
          organizationId: orgId,
          actorUserId: session.user.id,
          action: "record.created",
          resourceType: "water_record",
          resourceId: submissionId,
          metadata: { fromFieldSubmission: submissionId },
        });
      }

      // Auto-trigger a calculation run so the approved record is reflected
      // on the dashboard without requiring a manual run.
      scheduleCalculationForPeriod(
        orgId,
        submission.reportingPeriodId,
        session.user.id,
      ).catch((err) =>
        console.error("[field-submissions] Auto-calc schedule failed:", err),
      );
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
      metadata: { orgId, status: body.action, activityRecordId, reviewNote: body.reviewNote ?? null },
    }).catch((err) =>
      console.error("[field-submissions] Failed to dispatch review notification:", err),
    );

    // Update supplier performance metrics after review
    const submitterMembership = await prisma.organizationMembership.findFirst({
      where: { userId: submission.submittedByUserId },
      select: { organizationId: true },
    });

    if (submitterMembership) {
      await enqueueSupplierPerformanceUpdate({
        orgId,
        supplierId: submitterMembership.organizationId,
      }).catch((err) =>
        console.error(
          `[field-submissions] Failed to enqueue supplier performance update for ${submitterMembership.organizationId}:`,
          err,
        ),
      );
    }

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
