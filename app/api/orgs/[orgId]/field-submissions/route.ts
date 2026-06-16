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
    const submittedByMe = url.searchParams.get("submittedByMe") === "true";
    const cursor = url.searchParams.get("cursor");
    const take = 50;

    // field_workers always see only their own submissions
    const ownOnly = membership.role === "field_worker" || submittedByMe;

    const submissions = await prisma.fieldSubmission.findMany({
      where: {
        organizationId: orgId,
        ...(status ? { status: status as never } : {}),
        ...(ownOnly ? { submittedByUserId: session.user.id } : {}),
      },
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
    });

    const hasMore = submissions.length > take;
    const data = hasMore ? submissions.slice(0, take) : submissions;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return NextResponse.json({ data, nextCursor });
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

    // Support both JSON and multipart/form-data bodies (Flutter sends multipart
    // when a photo is attached).
    let rawBody: Record<string, unknown>;
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      rawBody = Object.fromEntries(
        [...fd.entries()].map(([k, v]) => [k, v instanceof File ? v : (v as string)])
      );
    } else {
      rawBody = await req.json();
    }

    // formData may arrive as a JSON-encoded string (Flutter pre-encodes it)
    // or as a plain object — normalise to object before Zod validation.
    if (typeof rawBody.formData === "string") {
      try { rawBody.formData = JSON.parse(rawBody.formData as string); } catch { rawBody.formData = {}; }
    }
    if (typeof rawBody.ocrExtractedData === "string") {
      try { rawBody.ocrExtractedData = JSON.parse(rawBody.ocrExtractedData as string); } catch { rawBody.ocrExtractedData = undefined; }
    }
    // gpsLat/gpsLng come as strings in multipart form data
    if (typeof rawBody.gpsLat === "string") rawBody.gpsLat = parseFloat(rawBody.gpsLat as string);
    if (typeof rawBody.gpsLng === "string") rawBody.gpsLng = parseFloat(rawBody.gpsLng as string);

    const body = createFieldSubmissionSchema.parse(rawBody);

    const period = await prisma.reportingPeriod.findUnique({
      where: { id: body.reportingPeriodId },
      select: { organizationId: true },
    });
    if (!period || period.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Reporting period not found.", 404);
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
        reportingPeriodId: body.reportingPeriodId,
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

    return NextResponse.json(submission, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
