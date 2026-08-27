import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";

// Delete a tag
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; tagId: string }> },
) {
  try {
    const { orgId, tagId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const tag = await prisma.supplierTag.findUnique({
      where: { id: tagId },
      include: { _count: { select: { assignments: true } } },
    });

    if (!tag || tag.organizationId !== orgId) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Tag not found" },
        { status: 404 },
      );
    }

    if (tag._count.assignments > 0) {
      return NextResponse.json(
        {
          code: "CONFLICT",
          message: `Cannot delete tag that has ${tag._count.assignments} assignment(s)`,
        },
        { status: 409 },
      );
    }

    await prisma.supplierTag.delete({
      where: { id: tagId },
    });

    // Audit log
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "supplier_tag.deleted",
      resourceType: "SupplierTag",
      resourceId: tagId,
      metadata: { name: tag.name },
    });

    return NextResponse.json({ message: "Tag deleted" });
  } catch (err) {
    return handleRouteError(err);
  }
}
