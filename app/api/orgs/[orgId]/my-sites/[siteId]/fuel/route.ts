export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string; siteId: string }> };

// GET /api/orgs/[orgId]/my-sites/[siteId]/fuel
//
// The active fuel stores and machines on a site, for the field app's "Fuel"
// entry (cached per site for offline use). Field workers only see sites they
// are assigned to, and only names, kinds and fuel types.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, siteId } = await params;
    const { session, membership } = await requireOrgMember(orgId, ...ROLE_GROUPS.reviewersAndEditors, "field_worker");

    const site = await prisma.site.findFirst({ where: { id: siteId, organizationId: orgId }, select: { id: true } });
    if (!site) return apiError("NOT_FOUND", "Site not found.", 404);
    if (membership.role === "field_worker") {
      const assignment = await prisma.fieldWorkerSiteAssignment.findUnique({
        where: { organizationId_userId_siteId: { organizationId: orgId, userId: session.user.id, siteId } },
        select: { id: true },
      });
      if (!assignment) return apiError("NOT_FOUND", "Site not found.", 404);
    }

    const [stores, machines] = await Promise.all([
      prisma.fuelStore.findMany({
        where: { organizationId: orgId, siteId, active: true },
        select: { id: true, name: true, kind: true, fuelType: true },
        orderBy: { name: "asc" },
      }),
      prisma.plantAsset.findMany({
        where: { organizationId: orgId, siteId, active: true },
        select: { id: true, name: true, category: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return NextResponse.json({ stores, machines });
  } catch (err) {
    return handleRouteError(err);
  }
}
