export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { reviewActivityRecordSchema } from "@/lib/validation/records";

type Params = { params: Promise<{ orgId: string; recordId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const record = await prisma.activityRecord.findUnique({
      where: { id: recordId },
      select: { organizationId: true, reviewStatus: true },
    });
    if (!record || record.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Activity record not found.", 404);
    }

    const body = reviewActivityRecordSchema.parse(await req.json());

    const updated = await prisma.activityRecord.update({
      where: { id: recordId },
      data: {
        reviewStatus: body.reviewStatus,
        ...(body.note !== undefined ? { assumptionNotes: body.note } : {}),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.reviewed",
      resourceType: "activity_record",
      resourceId: recordId,
      metadata: { reviewStatus: body.reviewStatus, previousStatus: record.reviewStatus },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
