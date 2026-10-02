export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; supplierId: string }> },
) {
  try {
    const { orgId, supplierId } = await params;
    const { session } = await requireOrgMember(
      orgId,
      "admin", "sustainability_director", "sustainability_manager", "contract_manager",
    );
    const removed = await prisma.svSupplierLocation.deleteMany({
      where: { id: supplierId, organizationId: orgId },
    });
    if (removed.count === 0) return apiError("NOT_FOUND", "Supplier not found.", 404);
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "sv_supplier_location.delete",
      resourceType: "SvSupplierLocation",
      resourceId: supplierId,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
