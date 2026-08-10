import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { z } from "zod";

type Params = { params: Promise<{ orgId: string; submissionId: string }> };

const resubmitSchema = z.object({
  formData: z.record(z.unknown()),
  ocrExtractedData: z.record(z.unknown()).optional(),
  documentType: z.enum(["waste_ticket", "delivery_note", "fuel_receipt", "other"]).optional(),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
  pickupPostcode: z.string().max(20).optional(),
  deliveryPostcode: z.string().max(20).optional(),
  evidenceFileIds: z.array(z.string()).optional(),
  // Offline sync retries dedupe on this — same semantics as the create route.
  idempotencyKey: z.string().max(128).optional(),
});

// POST /api/orgs/[orgId]/field-submissions/[submissionId]/resubmit
// Creates a new FieldSubmission linked to the original rejected one via resubmittedFromId.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, submissionId } = await params;
    const { session, membership } = await requireOrgMember(
      orgId,
      "admin",
      "editor",
      "reviewer",
      "field_worker",
    );

    const original = await prisma.fieldSubmission.findUnique({
      where: { id: submissionId },
      select: {
        organizationId: true,
        status: true,
        reportingPeriodId: true,
        emissionCategoryId: true,
        facilityId: true,
        siteId: true,
        contractId: true,
        documentType: true,
        submittedByUserId: true,
      },
    });

    if (!original || original.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Submission not found.", 404);
    }
    // Field workers may only resubmit their own submissions.
    if (
      membership.role === "field_worker" &&
      original.submittedByUserId !== session.user.id
    ) {
      return apiError("NOT_FOUND", "Submission not found.", 404);
    }
    if (original.status !== "rejected" && original.status !== "needs_info") {
      return apiError(
        "CONFLICT",
        "Only rejected or needs-info submissions can be resubmitted.",
        409,
      );
    }

    const rawBody = (await req.json()) as Record<string, unknown>;
    const headerIdempotencyKey = req.headers.get("idempotency-key");
    if (!rawBody.idempotencyKey && headerIdempotencyKey) {
      rawBody.idempotencyKey = headerIdempotencyKey;
    }
    const body = resubmitSchema.parse(rawBody);

    // Idempotent retry: return the already-created resubmission.
    if (body.idempotencyKey) {
      const existing = await prisma.fieldSubmission.findUnique({
        where: {
          organizationId_submittedByUserId_idempotencyKey: {
            organizationId: orgId,
            submittedByUserId: session.user.id,
            idempotencyKey: body.idempotencyKey,
          },
        },
      });
      if (existing) {
        return NextResponse.json(existing, { status: 200 });
      }
    }

    // Cross-tenant guard: evidence files must belong to this org.
    if (body.evidenceFileIds && body.evidenceFileIds.length > 0) {
      const ownedCount = await prisma.evidenceFile.count({
        where: { id: { in: body.evidenceFileIds }, organizationId: orgId },
      });
      if (ownedCount !== body.evidenceFileIds.length) {
        return apiError(
          "INVALID_EVIDENCE",
          "One or more evidence files do not belong to this organisation.",
          422,
        );
      }
    }

    const newSubmission = await prisma.fieldSubmission.create({
      data: {
        organizationId: orgId,
        reportingPeriodId: original.reportingPeriodId,
        emissionCategoryId: original.emissionCategoryId,
        facilityId: original.facilityId,
        siteId: original.siteId,
        contractId: original.contractId,
        submittedByUserId: session.user.id,
        documentType: body.documentType ?? original.documentType,
        status: "submitted",
        formData: body.formData as Prisma.InputJsonObject,
        ocrExtractedData: body.ocrExtractedData as Prisma.InputJsonObject | undefined,
        gpsLat: body.gpsLat,
        gpsLng: body.gpsLng,
        pickupPostcode: body.pickupPostcode,
        deliveryPostcode: body.deliveryPostcode,
        idempotencyKey: body.idempotencyKey,
        resubmittedFromId: submissionId,
        ...(body.evidenceFileIds && body.evidenceFileIds.length > 0
          ? {
              files: {
                create: body.evidenceFileIds.map((fileId) => ({ evidenceFileId: fileId })),
              },
            }
          : {}),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "field_submission.resubmitted",
      resourceType: "field_submission",
      resourceId: newSubmission.id,
      metadata: { originalSubmissionId: submissionId },
    });

    return NextResponse.json(newSubmission, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
