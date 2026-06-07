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
    });
    if (!submission) {
      return apiError("NOT_FOUND", "Field submission was not found.", 404);
    }

    let activityRecordId = submission.activityRecordId;
    if (body.status === "approved" && !activityRecordId) {
      if (!submission.emissionCategoryId) {
        return apiError("MISSING_CATEGORY", "Assign an emission category before approving this submission.", 422);
      }
      const formData = submission.formData as Record<string, unknown>;
      const amount = Number(formData.amount);
      const unit = String(formData.unit ?? "");
      if (!Number.isFinite(amount) || amount <= 0 || !unit) {
        return apiError("INVALID_FORM_DATA", "Submission form data must include a positive amount and unit.", 422);
      }

      const record = await prisma.activityRecord.create({
        data: {
          organizationId: orgId,
          reportingPeriodId: submission.reportingPeriodId,
          emissionCategoryId: submission.emissionCategoryId,
          facilityId: submission.facilityId,
          fieldSubmissionId: submission.id,
          createdByUserId: session.user.id,
          sourceDescription: String(formData.sourceDescription ?? submission.documentType),
          supplierName: formData.supplierName ? String(formData.supplierName) : undefined,
          amount,
          unit,
          activityDate: formData.activityDate ? new Date(String(formData.activityDate)) : undefined,
          reviewStatus: "approved",
          evidenceStatus: "missing",
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

    const updated = await prisma.fieldSubmission.update({
      where: { id: submission.id },
      data: {
        status: body.status,
        reviewNote: body.reviewNote,
        reviewedByUserId: session.user.id,
        reviewedAt: new Date(),
        activityRecordId,
      },
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
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
