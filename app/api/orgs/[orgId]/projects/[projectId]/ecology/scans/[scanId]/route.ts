export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { handleRouteError, apiError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string; projectId: string; scanId: string }> };

/**
 * GET /api/orgs/:orgId/projects/:projectId/ecology/scans/:scanId
 * Full scan detail including species records and designated sites.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, projectId, scanId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor", "sustainability_director");

    const scan = await prisma.ecologicalScan.findFirst({
      where: { id: scanId, projectId, organizationId: orgId },
    });
    if (!scan) return apiError("NOT_FOUND", "Scan not found.", 404);

    return NextResponse.json(scan);
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * DELETE /api/orgs/:orgId/projects/:projectId/ecology/scans/:scanId
 * Remove a scan record.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, projectId, scanId } = await params;
    await requireOrgMember(orgId, "admin", "sustainability_director");

    const scan = await prisma.ecologicalScan.findFirst({
      where: { id: scanId, projectId, organizationId: orgId },
      select: { id: true },
    });
    if (!scan) return apiError("NOT_FOUND", "Scan not found.", 404);

    await prisma.ecologicalScan.delete({ where: { id: scanId } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
