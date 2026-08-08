import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

type Params = { params: Promise<{ orgId: string; recordId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, recordId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director",
      "sustainability_manager", "contract_manager", "project_manager", "editor");

    const record = await prisma.wasteRecord.findUnique({
      where: { id: recordId },
      select: { id: true, organizationId: true },
    });
    if (!record) return apiError("NOT_FOUND", "Record not found", 404);
    if (record.organizationId !== orgId) return apiError("FORBIDDEN", "Access denied", 403);

    await prisma.wasteRecord.delete({ where: { id: recordId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "record.deleted",
      resourceType: "waste_record",
      resourceId: recordId,
      metadata: {},
    });

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
