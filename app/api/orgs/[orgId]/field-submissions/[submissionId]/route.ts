export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { presignDownload } from "@/lib/storage";
import { updateFieldSubmissionSchema } from "@/lib/validation/records";
import { calculateGpsDistanceKm } from "@/lib/geo/gps-distance";

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
        select: { totalCo2e: true },
      });
      if (latestCalc) co2eKg = Number(latestCalc.totalCo2e);
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
      // The site the worker submitted against — mobile needs it to start a
      // correction capture for the same site.
      siteId: submission.siteId,
      evidenceFiles,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// PATCH /api/orgs/[orgId]/field-submissions/[submissionId]
// Allows admins, editors, and reviewers to correct formData values and GPS
// coordinates on a pending/submitted/under_review/needs_info submission
// before approving it. Approved and rejected submissions are immutable.
export async function PATCH(
  req: NextRequest,
  { params }: Params,
) {
  try {
    const { orgId, submissionId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const rawBody = await req.json().catch(() => null);
    if (!rawBody) return apiError("INVALID_BODY", "Request body must be valid JSON.", 400);

    const body = updateFieldSubmissionSchema.safeParse(rawBody);
    if (!body.success) {
      return apiError("VALIDATION_ERROR", "Invalid request body.", 400, body.error.flatten());
    }

    const existing = await prisma.fieldSubmission.findFirst({
      where: { id: submissionId, organizationId: orgId },
      select: {
        id: true,
        status: true,
        formData: true,
        pickupPostcode: true,
        deliveryPostcode: true,
        pickupLat: true,
        pickupLng: true,
        deliveryLat: true,
        deliveryLng: true,
      },
    });
    if (!existing) return apiError("NOT_FOUND", "Submission not found.", 404);

    if (existing.status === "approved" || existing.status === "rejected") {
      return apiError(
        "IMMUTABLE",
        "Approved and rejected submissions cannot be edited.",
        409,
      );
    }

    // Determine final pickup/delivery GPS coords (new values override existing).
    const pickupLat = body.data.pickupLat !== undefined
      ? body.data.pickupLat
      : existing.pickupLat !== null ? Number(existing.pickupLat) : null;
    const pickupLng = body.data.pickupLng !== undefined
      ? body.data.pickupLng
      : existing.pickupLng !== null ? Number(existing.pickupLng) : null;
    const deliveryLat = body.data.deliveryLat !== undefined
      ? body.data.deliveryLat
      : existing.deliveryLat !== null ? Number(existing.deliveryLat) : null;
    const deliveryLng = body.data.deliveryLng !== undefined
      ? body.data.deliveryLng
      : existing.deliveryLng !== null ? Number(existing.deliveryLng) : null;

    // Re-calculate road distance if we have all four GPS coords and any changed.
    let calculatedDistanceKm: number | null | undefined = undefined;
    let distanceSource: string | null | undefined = undefined;
    if (
      pickupLat !== null && pickupLng !== null &&
      deliveryLat !== null && deliveryLng !== null
    ) {
      const gpsResult = await calculateGpsDistanceKm({
        pickupLat, pickupLng, deliveryLat, deliveryLng,
      });
      calculatedDistanceKm = gpsResult.distanceKm;
      distanceSource = gpsResult.source;
    } else if (
      (body.data.pickupLat === null || body.data.deliveryLat === null)
    ) {
      // Coords were explicitly cleared — remove distance.
      calculatedDistanceKm = null;
      distanceSource = null;
    }

    const updated = await prisma.fieldSubmission.update({
      where: { id: submissionId },
      data: {
        ...(body.data.formData !== undefined
          ? { formData: body.data.formData }
          : {}),
        ...(body.data.ocrExtractedData !== undefined
          ? { ocrExtractedData: body.data.ocrExtractedData }
          : {}),
        ...(body.data.emissionCategoryId !== undefined
          ? { emissionCategoryId: body.data.emissionCategoryId }
          : {}),
        ...(body.data.facilityId !== undefined
          ? { facilityId: body.data.facilityId }
          : {}),
        ...(body.data.pickupPostcode !== undefined
          ? { pickupPostcode: body.data.pickupPostcode }
          : {}),
        ...(body.data.deliveryPostcode !== undefined
          ? { deliveryPostcode: body.data.deliveryPostcode }
          : {}),
        ...(body.data.pickupLat !== undefined ? { pickupLat: body.data.pickupLat } : {}),
        ...(body.data.pickupLng !== undefined ? { pickupLng: body.data.pickupLng } : {}),
        ...(body.data.deliveryLat !== undefined ? { deliveryLat: body.data.deliveryLat } : {}),
        ...(body.data.deliveryLng !== undefined ? { deliveryLng: body.data.deliveryLng } : {}),
        ...(calculatedDistanceKm !== undefined ? { calculatedDistanceKm } : {}),
        ...(distanceSource !== undefined ? { distanceSource } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
