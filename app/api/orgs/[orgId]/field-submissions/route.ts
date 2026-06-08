import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { getOrCreateRouteDistance } from "@/lib/geo/route-distance";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createFieldSubmissionSchema } from "@/lib/validation/org";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session, membership } = await requireOrgMember(
      orgId,
      "admin",
      "editor",
      "reviewer",
      "viewer",
      "auditor",
      "field_worker",
    );
    const submittedByMe = req.nextUrl.searchParams.get("submittedByMe") === "true";
    const ownOnly = membership.role === "field_worker" || submittedByMe;

    const submissions = await prisma.fieldSubmission.findMany({
      where: {
        organizationId: orgId,
        ...(ownOnly ? { submittedByUserId: session.user.id } : {}),
      },
      include: {
        reportingPeriod: { select: { label: true } },
        emissionCategory: { select: { scope: true, name: true } },
        facility: { select: { name: true } },
        files: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(submissions);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(
      orgId,
      "admin",
      "editor",
      "field_worker",
    );
    const body = createFieldSubmissionSchema.parse(await req.json());

    const [period, category, facility, evidenceFiles] = await Promise.all([
      prisma.reportingPeriod.findFirst({
        where: { id: body.reportingPeriodId, organizationId: orgId },
        select: { id: true },
      }),
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
      body.evidenceIds.length > 0
        ? prisma.evidenceFile.findMany({
            where: {
              id: { in: body.evidenceIds },
              organizationId: orgId,
            },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);

    if (!period) {
      return apiError("INVALID_REPORTING_PERIOD", "Reporting period does not belong to this organisation.", 422);
    }
    if (body.emissionCategoryId && !category) {
      return apiError("INVALID_EMISSION_CATEGORY", "Emission category does not exist.", 422);
    }
    if (body.facilityId && !facility) {
      return apiError("INVALID_FACILITY", "Facility does not belong to this organisation.", 422);
    }
    if (evidenceFiles.length !== new Set(body.evidenceIds).size) {
      return apiError("INVALID_EVIDENCE", "One or more evidence files do not belong to this organisation.", 422);
    }

    if (body.idempotencyKey) {
      const existingSubmission = await prisma.fieldSubmission.findFirst({
        where: {
          organizationId: orgId,
          submittedByUserId: session.user.id,
          idempotencyKey: body.idempotencyKey,
        },
      });
      if (existingSubmission) {
        return NextResponse.json(existingSubmission);
      }
    }

    const routeDistance =
      body.pickupPostcode && body.deliveryPostcode
        ? await getOrCreateRouteDistance({
            organizationId: orgId,
            pickupPostcode: body.pickupPostcode,
            deliveryPostcode: body.deliveryPostcode,
          })
        : null;

    const evidenceIds = [...new Set(body.evidenceIds)];
    const submission = await prisma.fieldSubmission.create({
      data: {
        organizationId: orgId,
        reportingPeriodId: body.reportingPeriodId,
        emissionCategoryId: body.emissionCategoryId,
        facilityId: body.facilityId,
        submittedByUserId: session.user.id,
        documentType: body.documentType,
        status: "submitted",
        ocrExtractedData:
          (body.ocrExtractedData as Prisma.InputJsonObject | undefined) ??
          Prisma.JsonNull,
        formData: {
          ...body.formData,
          idempotencyKey: body.idempotencyKey,
        } as Prisma.InputJsonObject,
        idempotencyKey: body.idempotencyKey,
        gpsLat: body.gpsLat,
        gpsLng: body.gpsLng,
        pickupPostcode: routeDistance?.pickupPostcode ?? body.pickupPostcode,
        deliveryPostcode: routeDistance?.deliveryPostcode ?? body.deliveryPostcode,
        pickupLat: routeDistance?.pickupLat,
        pickupLng: routeDistance?.pickupLng,
        deliveryLat: routeDistance?.deliveryLat,
        deliveryLng: routeDistance?.deliveryLng,
        calculatedDistanceKm: routeDistance?.distanceKm,
        distanceSource: routeDistance?.provider,
        deviceSubmittedAt: body.deviceSubmittedAt
          ? new Date(body.deviceSubmittedAt)
          : undefined,
        ...(evidenceIds.length > 0
          ? {
              files: {
                createMany: {
                  data: evidenceIds.map((evidenceFileId) => ({
                    evidenceFileId,
                  })),
                },
              },
            }
          : {}),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "field_submission.submitted",
      resourceType: "field_submission",
      resourceId: submission.id,
      metadata: {
        documentType: submission.documentType,
        status: submission.status,
        evidenceCount: evidenceIds.length,
      },
    });

    return NextResponse.json(submission, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
