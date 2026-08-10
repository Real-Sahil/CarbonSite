import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createFieldSubmissionSchema } from "@/lib/validation/records";
import { dispatchNotification } from "@/lib/jobs/dispatch";
import { calculateGpsDistanceKm } from "@/lib/geo/gps-distance";

type Params = { params: Promise<{ orgId: string }> };

// Notify org admins and reviewers that a new submission needs review.
async function notifyReviewersOfSubmission(
  orgId: string,
  submissionId: string,
  submitterUserId: string,
) {
  const reviewers = await prisma.organizationMembership.findMany({
    where: {
      organizationId: orgId,
      role: { in: ["admin", "reviewer"] },
      userId: { not: submitterUserId },
    },
    select: { userId: true },
  });
  await Promise.all(
    reviewers.map((reviewer) =>
      dispatchNotification({
        type: "submission_received",
        recipientUserId: reviewer.userId,
        orgId,
        resourceId: submissionId,
        metadata: { orgId },
      }),
    ),
  );
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session, membership } = await requireOrgMember(
      orgId,
      "admin",
      "editor",
      "reviewer",
      "field_worker",
    );

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const submittedByMe = url.searchParams.get("submittedByMe") === "true";
    const cursor = url.searchParams.get("cursor");
    const take = 50;

    // field_workers can only see their own submissions; submittedByMe param
    // lets other roles filter to their own as well.
    const isFieldWorker = membership.role === "field_worker";
    const ownOnly = isFieldWorker || submittedByMe;
    const where = {
      organizationId: orgId,
      ...(ownOnly ? { submittedByUserId: session.user.id } : {}),
      ...(!isFieldWorker && status ? { status: status as never } : {}),
    };

    const [submissions, total] = await Promise.all([
      prisma.fieldSubmission.findMany({
        where,
        include: {
          submittedBy: { select: { name: true, email: true } },
          reportingPeriod: { select: { label: true } },
          emissionCategory: { select: { scope: true, name: true } },
          facility: { select: { name: true } },
          _count: { select: { files: true } },
        },
        orderBy: { createdAt: "desc" },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      prisma.fieldSubmission.count({ where }),
    ]);

    const hasMore = submissions.length > take;
    const page = hasMore ? submissions.slice(0, take) : submissions;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    // Attach the latest calculated CO2e per linked activity record and a flat
    // scope field — the mobile client reads both at the top level.
    const recordIds = page
      .map((s) => s.activityRecordId)
      .filter((id): id is string => Boolean(id));
    const co2eByRecord = new Map<string, number>();
    if (recordIds.length > 0) {
      const calcs = await prisma.emissionCalculation.findMany({
        where: { organizationId: orgId, activityRecordId: { in: recordIds } },
        orderBy: { createdAt: "desc" },
        select: { activityRecordId: true, totalCo2e: true },
      });
      for (const calc of calcs) {
        if (!co2eByRecord.has(calc.activityRecordId)) {
          co2eByRecord.set(calc.activityRecordId, Number(calc.totalCo2e));
        }
      }
    }
    const data = page.map((submission) => ({
      ...submission,
      scope: submission.emissionCategory?.scope ?? null,
      co2eKg: submission.activityRecordId
        ? co2eByRecord.get(submission.activityRecordId) ?? null
        : null,
    }));

    return NextResponse.json({ data, nextCursor, total });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    // field_workers can submit; org members can also submit on behalf
    const { session, membership } = await requireOrgMember(
      orgId,
      "admin",
      "editor",
      "reviewer",
      "field_worker",
    );

    // Accept both JSON (no photo) and multipart/form-data (photo attached).
    const contentType = req.headers.get("content-type") ?? "";
    let rawBody: Record<string, unknown>;
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      rawBody = {};
      for (const [key, value] of form.entries()) {
        // Skip empty strings so optional ids resolve to undefined, not "".
        // Skip File blobs — evidence is uploaded separately via presigned URL.
        if (typeof value === "string" && value !== "") rawBody[key] = value;
      }
      // Numeric fields from multipart arrive as strings — coerce before Zod.
      if (rawBody.gpsLat) rawBody.gpsLat = Number(rawBody.gpsLat);
      if (rawBody.gpsLng) rawBody.gpsLng = Number(rawBody.gpsLng);
      if (rawBody.pickupLat) rawBody.pickupLat = Number(rawBody.pickupLat);
      if (rawBody.pickupLng) rawBody.pickupLng = Number(rawBody.pickupLng);
      if (rawBody.deliveryLat) rawBody.deliveryLat = Number(rawBody.deliveryLat);
      if (rawBody.deliveryLng) rawBody.deliveryLng = Number(rawBody.deliveryLng);
    } else {
      rawBody = await req.json();
    }

    // formData and ocrExtractedData may arrive as JSON-encoded strings — normalise.
    if (typeof rawBody.formData === "string") {
      try { rawBody.formData = JSON.parse(rawBody.formData); } catch { rawBody.formData = {}; }
    }
    if (typeof rawBody.ocrExtractedData === "string") {
      try { rawBody.ocrExtractedData = JSON.parse(rawBody.ocrExtractedData); } catch { rawBody.ocrExtractedData = undefined; }
    }
    // Flutter embeds the raw OCR snapshot as __ocrExtracted__ inside formData
    // (avoids a Flutter schema migration). Extract and promote it here so the
    // server stores the pre-correction OCR values separately.
    if (rawBody.formData && typeof rawBody.formData === "object" && !Array.isArray(rawBody.formData)) {
      const embeddedOcr = (rawBody.formData as Record<string, unknown>)["__ocrExtracted__"];
      if (embeddedOcr && typeof embeddedOcr === "object" && !Array.isArray(embeddedOcr)) {
        rawBody.ocrExtractedData = rawBody.ocrExtractedData ?? embeddedOcr;
        delete (rawBody.formData as Record<string, unknown>)["__ocrExtracted__"];
      }
    }

    // The mobile sync service sends the idempotency key as an HTTP header;
    // accept it there as well as in the body so offline retries dedupe.
    const headerIdempotencyKey = req.headers.get("idempotency-key");
    if (!rawBody.idempotencyKey && headerIdempotencyKey) {
      rawBody.idempotencyKey = headerIdempotencyKey;
    }

    const body = createFieldSubmissionSchema.parse(rawBody);

    // Resolve the site (preferred path) and derive the contract for tagging.
    const siteId: string | undefined = body.siteId;
    let contractId: string | undefined;
    if (siteId) {
      const site = await prisma.site.findFirst({
        where: { id: siteId, organizationId: orgId },
        select: { id: true, project: { select: { contractId: true } } },
      });
      if (!site) {
        return apiError("NOT_FOUND", "Site not found.", 404);
      }
      // External field workers may only submit against sites they are
      // assigned to — never other contractors' sites in the same org.
      if (membership.role === "field_worker") {
        const assignment = await prisma.fieldWorkerSiteAssignment.findUnique({
          where: {
            organizationId_userId_siteId: {
              organizationId: orgId,
              userId: session.user.id,
              siteId,
            },
          },
          select: { id: true },
        });
        if (!assignment) {
          return apiError(
            "SITE_NOT_ASSIGNED",
            "You are not assigned to this site. Ask your administrator for access.",
            403,
          );
        }
      }
      contractId = site.project?.contractId;
    }

    // Cross-tenant guards: evidence files and facility must belong to this org.
    if (body.evidenceIds && body.evidenceIds.length > 0) {
      const ownedCount = await prisma.evidenceFile.count({
        where: { id: { in: body.evidenceIds }, organizationId: orgId },
      });
      if (ownedCount !== body.evidenceIds.length) {
        return apiError(
          "INVALID_EVIDENCE",
          "One or more evidence files do not belong to this organisation.",
          422,
        );
      }
    }
    if (body.facilityId) {
      const facility = await prisma.facility.findFirst({
        where: { id: body.facilityId, organizationId: orgId },
        select: { id: true },
      });
      if (!facility) {
        return apiError("INVALID_FACILITY", "Facility does not belong to this organisation.", 422);
      }
    }

    // Resolve the reporting period: explicit id wins, otherwise pick the period
    // whose date range contains the submission date (falling back to the most
    // recent period). Field workers never choose a period themselves.
    let reportingPeriodId = body.reportingPeriodId;
    if (reportingPeriodId) {
      const period = await prisma.reportingPeriod.findUnique({
        where: { id: reportingPeriodId },
        select: { organizationId: true },
      });
      if (!period || period.organizationId !== orgId) {
        return apiError("NOT_FOUND", "Reporting period not found.", 404);
      }
    } else {
      const submissionDate = body.deviceSubmittedAt
        ? new Date(body.deviceSubmittedAt)
        : new Date();
      const covering = await prisma.reportingPeriod.findFirst({
        where: {
          organizationId: orgId,
          startDate: { lte: submissionDate },
          endDate: { gte: submissionDate },
        },
        orderBy: { startDate: "desc" },
        select: { id: true },
      });
      const resolved =
        covering ??
        (await prisma.reportingPeriod.findFirst({
          where: { organizationId: orgId },
          orderBy: { startDate: "desc" },
          select: { id: true },
        }));
      if (!resolved) {
        return apiError(
          "NO_REPORTING_PERIOD",
          "No reporting period is set up for this organisation. Ask an administrator to create one.",
          422,
        );
      }
      reportingPeriodId = resolved.id;
    }

    // Idempotency: if the same key exists for this user+org, return the existing record
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

    // Calculate road distance from GPS coordinates when both pickup and
    // delivery points are provided. Stored immediately so reviewers can see
    // the distance on the ticket detail page without waiting for approval.
    let calculatedDistanceKm: number | undefined;
    let distanceSource: string | undefined;
    if (
      body.pickupLat !== undefined && body.pickupLng !== undefined &&
      body.deliveryLat !== undefined && body.deliveryLng !== undefined
    ) {
      const gpsResult = await calculateGpsDistanceKm({
        pickupLat: body.pickupLat,
        pickupLng: body.pickupLng,
        deliveryLat: body.deliveryLat,
        deliveryLng: body.deliveryLng,
      });
      calculatedDistanceKm = gpsResult.distanceKm;
      distanceSource = gpsResult.source;
    }

    let submission;
    try {
      submission = await prisma.fieldSubmission.create({
        data: {
          organizationId: orgId,
          reportingPeriodId,
          siteId,
          contractId,
          documentType: body.documentType,
          formData: body.formData,
          emissionCategoryId: body.emissionCategoryId,
          facilityId: body.facilityId,
          ocrExtractedData: body.ocrExtractedData,
          gpsLat: body.gpsLat,
          gpsLng: body.gpsLng,
          pickupPostcode: body.pickupPostcode,
          deliveryPostcode: body.deliveryPostcode,
          pickupLat: body.pickupLat,
          pickupLng: body.pickupLng,
          deliveryLat: body.deliveryLat,
          deliveryLng: body.deliveryLng,
          calculatedDistanceKm,
          distanceSource,
          deviceSubmittedAt: body.deviceSubmittedAt ? new Date(body.deviceSubmittedAt) : undefined,
          idempotencyKey: body.idempotencyKey,
          status: "submitted",
          submittedByUserId: session.user.id,
        },
      });
    } catch (createErr) {
      // Concurrent retry with the same idempotency key: the find-then-create
      // above races; the unique constraint wins — return the existing row.
      if (
        body.idempotencyKey &&
        createErr instanceof Prisma.PrismaClientKnownRequestError &&
        createErr.code === "P2002"
      ) {
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
      throw createErr;
    }

    // Link pre-uploaded evidence files (uploaded separately via presigned URL)
    if (body.evidenceIds && body.evidenceIds.length > 0) {
      await prisma.fieldSubmissionFile.createMany({
        data: body.evidenceIds.map((evidenceFileId) => ({
          fieldSubmissionId: submission.id,
          evidenceFileId,
        })),
        skipDuplicates: true,
      });
    }

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "field_submission.submitted",
      resourceType: "field_submission",
      resourceId: submission.id,
      metadata: { documentType: submission.documentType },
    });

    // Tell reviewers new field evidence has arrived — otherwise the review
    // queue is poll-only. Notify admins and reviewers, not the submitter.
    notifyReviewersOfSubmission(orgId, submission.id, session.user.id).catch((err) =>
      console.error("[field-submissions] reviewer notification failed:", err),
    );

    return NextResponse.json(submission, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
