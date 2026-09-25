export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { hasFeature } from "@/lib/billing/limits";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { openContractKpis } from "@/lib/social-value/field-capture";

type Params = { params: Promise<{ orgId: string; siteId: string }> };

// GET /api/orgs/[orgId]/my-sites/[siteId]/social-value
//
// The open social value KPIs on the contract this site belongs to, for the
// field app's "Social value" entry. Field workers only see sites they are
// assigned to, and only each KPI's title, unit, target and criterion.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, siteId } = await params;
    const { session, membership } = await requireOrgMember(orgId, ...ROLE_GROUPS.reviewersAndEditors, "field_worker");

    const site = await prisma.site.findFirst({
      where: { id: siteId, organizationId: orgId },
      select: { id: true, project: { select: { contractId: true, contract: { select: { name: true } } } } },
    });
    if (!site) return apiError("NOT_FOUND", "Site not found.", 404);
    if (membership.role === "field_worker") {
      const assignment = await prisma.fieldWorkerSiteAssignment.findUnique({
        where: { organizationId_userId_siteId: { organizationId: orgId, userId: session.user.id, siteId } },
        select: { id: true },
      });
      if (!assignment) return apiError("NOT_FOUND", "Site not found.", 404);
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true, isPilot: true } });
    const enabled = !!org && (org.isPilot || hasFeature(org.plan, "socialValue"));
    const contractId = site.project?.contractId ?? null;
    const kpis = enabled && contractId ? await openContractKpis(orgId, contractId) : [];

    return NextResponse.json({
      enabled,
      contractName: contractId ? (site.project?.contract?.name ?? null) : null,
      kpis,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
