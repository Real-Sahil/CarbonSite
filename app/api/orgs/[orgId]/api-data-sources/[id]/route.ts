export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string; id: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { orgId, id } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor");

    const source = await prisma.apiDataSource.findUnique({
      where: { id },
      select: { id: true, organizationId: true, name: true },
    });

    if (!source) {
      return apiError("NOT_FOUND", "API data source not found", 404);
    }

    if (source.organizationId !== orgId) {
      return apiError("FORBIDDEN", "You do not have permission to delete this data source", 403);
    }

    await prisma.apiDataSource.delete({ where: { id } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "integration.disconnected",
      resourceType: "ApiDataSource",
      resourceId: id,
      metadata: { name: source.name },
    });

    return NextResponse.json({ message: "API data source deleted" });
  } catch (err) {
    return handleRouteError(err);
  }
}
