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
    await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const cursor = url.searchParams.get("cursor");
    const take = 50;

    const submissions = await prisma.fieldSubmission.findMany({
      where: {
        organizationId: orgId,
        ...(status ? { status: status as never } : {}),
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

    const body = createFieldSubmissionSchema.parse(await req.json());

    const period = await prisma.reportingPeriod.findUnique({
      where: { id: body.reportingPeriodId },
      select: { organizationId: true },
    });
    if (!period || period.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Reporting period not found.", 404);
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
