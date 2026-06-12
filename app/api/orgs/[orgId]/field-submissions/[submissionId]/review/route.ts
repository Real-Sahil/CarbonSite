import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { reviewFieldSubmissionSchema } from "@/lib/validation/records";

type Params = { params: Promise<{ orgId: string; submissionId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, submissionId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const submission = await prisma.fieldSubmission.findUnique({
      where: { id: submissionId },
      select: { organizationId: true, status: true, reportingPeriodId: true },
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

      // Read submission form data to extract amount/unit
      const full = await prisma.fieldSubmission.findUnique({
        where: { id: submissionId },
        select: { formData: true },
      });
      const formData = (full?.formData ?? {}) as Record<string, unknown>;

      // Create committed ActivityRecord from submission
      const record = await prisma.activityRecord.create({
        data: {
          organizationId: orgId,
          reportingPeriodId: submission.reportingPeriodId,
          emissionCategoryId: body.emissionCategoryId,
          facilityId: body.facilityId,
          fieldSubmissionId: submissionId,
          amount: Number(formData["amount"] ?? 0) || 0,
          unit: String(formData["unit"] ?? "units"),
          sourceDescription: String(formData["sourceDescription"] ?? "Field submission"),
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

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
