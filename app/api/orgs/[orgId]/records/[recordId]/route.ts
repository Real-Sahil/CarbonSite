import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { updateActivityRecordStatusSchema } from "@/lib/validation/org";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; recordId: string }> },
) {
  try {
    const { orgId, recordId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "record-update", session.user.id),
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;
    const body = updateActivityRecordStatusSchema.parse(await req.json());

    const record = await prisma.activityRecord.findFirst({
      where: { id: recordId, organizationId: orgId },
      select: {
        id: true,
        reviewStatus: true,
        evidenceStatus: true,
        assumptionNotes: true,
      },
    });

    if (!record) {
      return apiError("NOT_FOUND", "Activity record was not found.", 404);
    }

    const updated = await prisma.activityRecord.update({
      where: { id: record.id },
      data: {
        reviewStatus: body.reviewStatus,
        ...(body.evidenceStatus !== undefined && {
          evidenceStatus: body.evidenceStatus,
        }),
        ...(body.assumptionNotes !== undefined && {
          assumptionNotes: body.assumptionNotes,
        }),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action:
        record.reviewStatus !== body.reviewStatus
          ? "record.reviewed"
          : "record.updated",
      resourceType: "activity_record",
      resourceId: record.id,
      metadata: {
        previousReviewStatus: record.reviewStatus,
        reviewStatus: updated.reviewStatus,
        previousEvidenceStatus: record.evidenceStatus,
        evidenceStatus: updated.evidenceStatus,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; recordId: string }> },
) {
  try {
    const { orgId, recordId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "record-delete", session.user.id),
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const record = await prisma.activityRecord.findFirst({
      where: { id: recordId, organizationId: orgId },
      select: {
        id: true,
        sourceDescription: true,
        reviewStatus: true,
        amount: true,
        unit: true,
        _count: { select: { calculations: true } },
      },
    });

    if (!record) {
      return apiError("NOT_FOUND", "Activity record was not found.", 404);
    }

    if (record._count.calculations > 0) {
      return apiError(
        "RECORD_HAS_CALCULATIONS",
        "This record has calculation history and cannot be deleted. Reject it or create a corrected replacement record.",
        409,
      );
    }

    await prisma.activityRecord.delete({ where: { id: record.id } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.deleted",
      resourceType: "activity_record",
      resourceId: record.id,
      metadata: {
        sourceDescription: record.sourceDescription,
        reviewStatus: record.reviewStatus,
        amount: record.amount.toString(),
        unit: record.unit,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
