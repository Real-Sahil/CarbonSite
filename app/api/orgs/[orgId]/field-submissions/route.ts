import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { createFieldSubmissionSchema } from "@/lib/validation/records";

type Params = { params: Promise<{ orgId: string }> };

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
    const cursor = url.searchParams.get("cursor");
    const take = 50;

    // field_workers can only see their own submissions
    const isFieldWorker = membership.role === "field_worker";
    const where = {
      organizationId: orgId,
      ...(isFieldWorker ? { submittedByUserId: session.user.id } : {}),
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
    const data = hasMore ? submissions.slice(0, take) : submissions;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return NextResponse.json({ data, nextCursor, total });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    // field_workers can submit; org members can also submit on behalf
    const { session } = await requireOrgMember(
      orgId,
      "admin",
      "editor",
      "reviewer",
      "field_worker",
    );

    // Accept both JSON (no photo) and multipart/form-data (photo attached).
    // The Flutter sync service sends multipart when a photo is present.
    const contentType = req.headers.get("content-type") ?? "";
    let rawBody: Record<string, unknown>;
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      rawBody = {};
      for (const [key, value] of form.entries()) {
        // Skip empty strings so optional ids resolve to undefined, not "".
        if (typeof value === "string" && value !== "") rawBody[key] = value;
        // Photo binary is intentionally ignored here; OCR data is in formData JSON
      }
      // formData field arrives as a JSON string — parse it back
      if (typeof rawBody.formData === "string") {
        try { rawBody.formData = JSON.parse(rawBody.formData); } catch { /* leave as-is */ }
      }
      // Numeric fields from multipart arrive as strings
      if (rawBody.gpsLat) rawBody.gpsLat = Number(rawBody.gpsLat);
      if (rawBody.gpsLng) rawBody.gpsLng = Number(rawBody.gpsLng);
    } else {
      rawBody = await req.json();
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
      contractId = site.project?.contractId;
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

    const submission = await prisma.fieldSubmission.create({
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
        deviceSubmittedAt: body.deviceSubmittedAt ? new Date(body.deviceSubmittedAt) : undefined,
        idempotencyKey: body.idempotencyKey,
        status: "submitted",
        submittedByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "field_submission.submitted",
      resourceType: "field_submission",
      resourceId: submission.id,
      metadata: { documentType: submission.documentType },
    });

    return NextResponse.json(submission, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
