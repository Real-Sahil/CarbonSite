import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

// DELETE /api/orgs/[orgId]/api-keys/[keyId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; keyId: string }> },
) {
  try {
    const { orgId, keyId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");

    const key = await prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!key || key.organizationId !== orgId) {
      return apiError("NOT_FOUND", "API key not found", 404);
    }

    await prisma.apiKey.delete({ where: { id: keyId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "api_key.deleted",
      resourceType: "ApiKey",
      resourceId: keyId,
      metadata: { name: key.name },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
