export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

const updateScope2MethodSchema = z.object({
  scope2Method: z.union([z.enum(["location_based", "market_based"]), z.null()]),
});

async function resolveRecord(orgId: string, recordId: string) {
  return prisma.activityRecord.findUnique({
    where: { id: recordId, organizationId: orgId },
    include: { emissionCategory: { select: { scope: true, code: true, name: true } } },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; recordId: string }> },
) {
  try {
    const { orgId, recordId } = await params;
    const { session } = await requireOrgMember(
      orgId,
      "admin",
      "sustainability_director",
      "sustainability_manager",
      "editor",
      "reviewer",
    );

    const record = await resolveRecord(orgId, recordId);
    if (!record) return apiError("NOT_FOUND", "Activity record not found.", 404);

    // Only allow scope 2 records to be updated
    if (record.emissionCategory.scope !== 2) {
      return apiError(
        "INVALID_REQUEST",
        "Scope 2 method can only be set on Scope 2 emission categories.",
        400,
      );
    }

    const body = updateScope2MethodSchema.parse(await req.json());
    const previousMethod = record.scope2Method;

    const updated = await prisma.activityRecord.update({
      where: { id: recordId },
      data: {
        scope2Method: body.scope2Method as any,
        updatedAt: new Date(),
      },
      include: { emissionCategory: true },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.updated",
      resourceType: "ActivityRecord",
      resourceId: recordId,
      metadata: {
        field: "scope2Method",
        previousValue: previousMethod,
        newValue: body.scope2Method,
        categoryCode: record.emissionCategory.code,
      },
    });

    return NextResponse.json({
      id: updated.id,
      scope2Method: updated.scope2Method,
      message: `Scope 2 method updated to ${body.scope2Method || "unset"}`,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
