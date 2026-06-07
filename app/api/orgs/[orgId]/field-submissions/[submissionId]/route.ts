import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { reviewFieldSubmissionSchema } from "@/lib/validation/org";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; submissionId: string }> },
) {
  try {
    const { orgId, submissionId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");
    const body = reviewFieldSubmissionSchema.parse(await req.json());

    const submission = await prisma.fieldSubmission.findFirst({
      where: { id: submissionId, organizationId: orgId },
      include: {
        files: { select: { evidenceFileId: true } },
      },
    });
    if (!submission) {
      return apiError("NOT_FOUND", "Field submission was not found.", 404);
    }

    const evidenceFileIds = submission.files.map((file) => file.evidenceFileId);
    let activityRecordId = submission.activityRecordId;

    if (body.status === "approved") {
      if (!submission.emissionCategoryId) {
        return apiError("MISSING_CATEGORY", "Assign an emission category before approving this submission.", 422);
      }
      const formData = submission.formData as Record<string, unknown>;
      const amount = Number(formData.amount);
      const unit = String(formData.unit ?? "");
      if (!Number.isFinite(amount) || amount <= 0 || !unit) {
        return apiError("INVALID_FORM_DATA", "Submission form data must include a positive amount and unit.", 422);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (body.status === "approved" && !activityRecordId) {
        const formData = submission.formData as Record<string, unknown>;
        const record = await tx.activityRecord.create({
          data: {
            organizationId: orgId,
            reportingPeriodId: submission.reportingPeriodId,
            emissionCategoryId: submission.emissionCategoryId!,
            facilityId: submission.facilityId,
            fieldSubmissionId: submission.id,
            createdByUserId: session.user.id,
            sourceDescription: String(formData.sourceDescription ?? submission.documentType),
            supplierName: formData.supplierName ? String(formData.supplierName) : undefined,
            amount: Number(formData.amount),
            unit: String(formData.unit),
            activityDate: formData.activityDate ? new Date(String(formData.activityDate)) : undefined,
            reviewStatus: "approved",
            evidenceStatus: evidenceFileIds.length > 0 ? "complete" : "missing",
            pickupPostcode: submission.pickupPostcode,
            deliveryPostcode: submission.deliveryPostcode,
            pickupLat: submission.pickupLat,
            pickupLng: submission.pickupLng,
            deliveryLat: submission.deliveryLat,
            deliveryLng: submission.deliveryLng,
            distanceAmount: submission.calculatedDistanceKm,
            distanceUnit: submission.calculatedDistanceKm ? "km" : undefined,
            routeDistanceSource: submission.distanceSource,
          },
        });
        activityRecordId = record.id;
      }

      if (body.status === "approved" && activityRecordId && evidenceFileIds.length > 0) {
        await tx.activityRecordEvidence.createMany({
          data: evidenceFileIds.map((evidenceFileId) => ({
            organizationId: orgId,
            activityRecordId: activityRecordId!,
            evidenceFileId,
          })),
          skipDuplicates: true,
        });

        await tx.activityRecord.update({
          where: { id: activityRecordId },
          data: { evidenceStatus: "complete" },
        });
      }

      return tx.fieldSubmission.update({
        where: { id: submission.id },
        data: {
          status: body.status,
          reviewNote: body.reviewNote,
          reviewedByUserId: session.user.id,
          reviewedAt: new Date(),
          activityRecordId,
        },
      });
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "field_submission.reviewed",
      resourceType: "field_submission",
      resourceId: updated.id,
      metadata: {
        status: updated.status,
        activityRecordId: updated.activityRecordId,
        evidenceCount: evidenceFileIds.length,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
