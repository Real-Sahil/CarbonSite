import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { reviewFieldSubmissionSchema } from "@/lib/validation/records";
import { enqueueNotification } from "@/lib/jobs/queues/index";

type Params = { params: Promise<{ orgId: string; submissionId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, submissionId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const submission = await prisma.fieldSubmission.findUnique({
      where: { id: submissionId },
      select: { organizationId: true, status: true, reportingPeriodId: true, submittedByUserId: true },
    });
    if (!submission || submission.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Submission not found.", 404);
    }
    if (submission.status === "approved" || submission.status === "rejected") {
      return apiError("CONFLICT", "Submission is already resolved.", 409);
    }

    const body = reviewFieldSubmissionSchema.parse(await req.json());

    let activityRecordId: string | undefined;

    if (body.action === "approved") {
      if (!body.emissionCategoryId) {
        return apiError("VALIDATION_ERROR", "emissionCategoryId is required to approve.", 422);
      }

      // Read submission form data and documentType to extract amount/unit
      const full = await prisma.fieldSubmission.findUnique({
        where: { id: submissionId },
        select: { formData: true, documentType: true },
      });
      const formData = (full?.formData ?? {}) as Record<string, unknown>;
      const docType = full?.documentType ?? "other";

      // Map document-type field names to canonical amount/unit.
      // Flutter sends type-specific keys: weight/weightUnit, quantity/quantityUnit,
      // volume/volumeUnit. Fall back to generic amount/unit for other types.
      let amount: number;
      let unit: string;
      switch (docType) {
        case "waste_ticket":
          amount = Number(formData["weight"] ?? formData["amount"] ?? 0) || 0;
          unit = String(formData["weightUnit"] ?? formData["unit"] ?? "kg");
          break;
        case "delivery_note":
          amount = Number(formData["quantity"] ?? formData["weight"] ?? formData["amount"] ?? 0) || 0;
          unit = String(formData["quantityUnit"] ?? formData["weightUnit"] ?? formData["unit"] ?? "units");
          break;
        case "fuel_receipt":
          amount = Number(formData["volume"] ?? formData["amount"] ?? 0) || 0;
          unit = String(formData["volumeUnit"] ?? formData["unit"] ?? "litres");
          break;
        default:
          amount = Number(formData["amount"] ?? 0) || 0;
          unit = String(formData["unit"] ?? "units");
      }

      const sourceDesc =
        String(formData["supplierName"] ?? formData["description"] ?? "Field submission");

      // Create committed ActivityRecord from submission
      const record = await prisma.activityRecord.create({
        data: {
          organizationId: orgId,
          reportingPeriodId: submission.reportingPeriodId,
          emissionCategoryId: body.emissionCategoryId,
          facilityId: body.facilityId,
          fieldSubmissionId: submissionId,
          amount,
          unit,
          sourceDescription: sourceDesc,
          createdByUserId: session.user.id,
        },
      });
      activityRecordId = record.id;

      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "record.created",
        resourceType: "activity_record",
        resourceId: record.id,
        metadata: { fromFieldSubmission: submissionId },
      });
    }

    const updated = await prisma.fieldSubmission.update({
      where: { id: submissionId },
      data: {
        status: body.action,
        reviewedByUserId: session.user.id,
        reviewedAt: new Date(),
        reviewNote: body.reviewNote,
        ...(body.emissionCategoryId ? { emissionCategoryId: body.emissionCategoryId } : {}),
        ...(body.facilityId ? { facilityId: body.facilityId } : {}),
        ...(activityRecordId ? { activityRecordId } : {}),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "field_submission.reviewed",
      resourceType: "field_submission",
      resourceId: submissionId,
      metadata: { action: body.action },
    });

    // Notify field worker of review outcome
    enqueueNotification({
      type: "submission_reviewed",
      recipientUserId: submission.submittedByUserId,
      orgId,
      resourceId: submissionId,
    }).catch((err) => console.error("[field-submissions] Failed to enqueue notification:", err));

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
