import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { updateBusinessUnitSchema } from "@/lib/validation/org";

async function resolveBusinessUnit(orgId: string, businessUnitId: string) {
  const bu = await prisma.businessUnit.findUnique({
    where: { id: businessUnitId },
  });
  if (!bu || bu.organizationId !== orgId) {
    return null;
  }
  return bu;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; businessUnitId: string }> },
) {
  try {
    const { orgId, businessUnitId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const bu = await resolveBusinessUnit(orgId, businessUnitId);
    if (!bu) {
      return apiError("NOT_FOUND", "Business unit not found.", 404);
    }

    const body = updateBusinessUnitSchema.parse(await req.json());

    const updated = await prisma.businessUnit.update({
      where: { id: businessUnitId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "business_unit.updated",
      resourceType: "business_unit",
      resourceId: businessUnitId,
      metadata: { changes: body },
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; businessUnitId: string }> },
) {
  try {
    const { orgId, businessUnitId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const bu = await resolveBusinessUnit(orgId, businessUnitId);
    if (!bu) {
      return apiError("NOT_FOUND", "Business unit not found.", 404);
    }

    const refCount = await prisma.activityRecord.count({
      where: { businessUnitId, organizationId: orgId },
    });

    if (refCount > 0) {
      return apiError(
        "BUSINESS_UNIT_IN_USE",
        `Cannot delete business unit — it is referenced by ${refCount} activity record(s). Reassign or delete those records first.`,
        409,
      );
    }

    await prisma.businessUnit.delete({ where: { id: businessUnitId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "business_unit.deleted",
      resourceType: "business_unit",
      resourceId: businessUnitId,
      metadata: { name: bu.name },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
