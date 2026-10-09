export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import { loadWastePlan } from "@/lib/waste/swmp-load";

// POST: approve the plan. Every check must pass; the approval is recorded with who and when.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ orgId: string; projectId: string }> }) {
  try {
    const { orgId, projectId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const refs = await orgRefsError(orgId, { projectId });
    if (refs) return refs;
    const loaded = await loadWastePlan(orgId, projectId);
    if (!loaded.exists) return apiError("NOT_FOUND", "There is no plan for this project yet.", 404);
    const missing = loaded.checks.filter((c) => !c.ok);
    if (missing.length > 0) return apiError("PLAN_INCOMPLETE", "Complete the plan before approving it.", 409, { missing: missing.map((c) => c.label) });
    await prisma.siteWastePlan.updateMany({ where: { organizationId: orgId, projectId }, data: { status: "approved", approvedAt: new Date(), approvedByUserId: session.user.id } });
    await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: "waste_plan.approved", resourceType: "SiteWastePlan", resourceId: projectId, metadata: { version: loaded.version } });
    return NextResponse.json({ status: "approved", version: loaded.version });
  } catch (err) {
    return handleRouteError(err);
  }
}
