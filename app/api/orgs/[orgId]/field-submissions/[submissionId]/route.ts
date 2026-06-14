import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { dispatchNotification } from "@/lib/jobs/dispatch";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { reviewFieldSubmissionSchema } from "@/lib/validation/org";
import { presignDownload } from "@/lib/storage";

type Params = { params: Promise<{ orgId: string; submissionId: string }> };

// GET /api/orgs/[orgId]/field-submissions/[submissionId]
// Accessible by org members (all roles) AND the field worker who submitted it.
export async function GET(
  _req: NextRequest,
  { params }: Params,
) {
  try {
    const { orgId, submissionId } = await params;
    const { session, membership } = await requireOrgMember(
      orgId,
      "admin", "editor", "reviewer", "viewer", "auditor", "field_worker",
    );

    const submission = await prisma.fieldSubmission.findFirst({
      where: {
        id: submissionId,
        organizationId: orgId,
        // field_workers can only see their own submissions
        ...(membership.role === "field_worker"
          ? { submittedByUserId: session.user.id }
          : {}),
      },
      include: {
        emissionCategory: { select: { scope: true, name: true } },
        facility: { select: { name: true } },
        files: {
          include: {
            evidenceFile: { select: { id: true, filename: true, storageKey: true } },
          },
        },
      },
    });

    if (!submission) {
      return apiError("NOT_FOUND", "Submission not found.", 404);
    }

    // Fetch latest CO2e if an activity record was created from this submission
    let co2eKg: number | null = null;
    if (submission.activityRecordId) {
      const latestCalc = await prisma.emissionCalculation.findFirst({
        where: { activityRecordId: submission.activityRecordId },
        orderBy: { createdAt: "desc" },
        select: { co2: true },
      });
      if (latestCalc) co2eKg = Number(latestCalc.co2);
    }

    // Generate 15-minute presigned download URLs for evidence files
    const evidenceFiles = await Promise.all(
      submission.files
        .filter((f) => f.evidenceFile !== null)
        .map(async (f) => {
          let downloadUrl: string | null = null;
          try {
            if (f.evidenceFile?.storageKey) {
              downloadUrl = await presignDownload(f.evidenceFile.storageKey);
            }
          } catch {
            // Presign failure is non-fatal — return filename without URL
          }
          return {
            id: f.evidenceFile!.id,
            filename: f.evidenceFile!.filename,
            downloadUrl,
          };
        }),
    );

    return NextResponse.json({
      id: submission.id,
      documentType: submission.documentType,
      status: submission.status,
      createdAt: submission.createdAt,
      reviewNote: submission.reviewNote,
      co2eKg,
      scope: submission.emissionCategory?.scope ?? null,
      evidenceFiles,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; submissionId: string }> },
) {
  try {
    const { orgId, submissionId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");
    const limited = rateLimitRequest(req, {
      key: rateLimitKey(orgId, "submission_review", session.user.id),
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;
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

    const [category, facility] = await Promise.all([
      body.emissionCategoryId
        ? prisma.emissionCategory.findUnique({
            where: { id: body.emissionCategoryId },
            select: { id: true },
          })
        : Promise.resolve(null),
      body.facilityId
        ? prisma.facility.findFirst({
            where: { id: body.facilityId, organizationId: orgId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (body.emissionCategoryId && !category) {
      return apiError("INVALID_EMISSION_CATEGORY", "Emission category does not exist.", 422);
    }
    if (body.facilityId && !facility) {
      return apiError("INVALID_FACILITY", "Facility does not belong to this organisation.", 422);
    }

    const evidenceFileIds = submission.files.map((file) => file.evidenceFileId);
    let activityRecordId = submission.activityRecordId;
    const assignedEmissionCategoryId = body.emissionCategoryId ?? submission.emissionCategoryId;
    const assignedFacilityId =
      body.facilityId === null ? null : body.facilityId ?? submission.facilityId;

    if (body.status === "approved") {
      if (!assignedEmissionCategoryId) {
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
            emissionCategoryId: assignedEmissionCategoryId!,
            facilityId: assignedFacilityId,
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
          emissionCategoryId: assignedEmissionCategoryId,
          facilityId: assignedFacilityId,
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
        emissionCategoryId: updated.emissionCategoryId,
        facilityId: updated.facilityId,
        evidenceCount: evidenceFileIds.length,
      },
    });
    await dispatchNotification({
      type: "submission_reviewed",
      recipientUserId: updated.submittedByUserId,
      orgId,
      resourceId: updated.id,
      metadata: {
        orgId,
        status: updated.status,
        activityRecordId: updated.activityRecordId,
      },
    }).catch((notificationErr) => {
      console.error("[notifications] submission review email failed", notificationErr);
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
