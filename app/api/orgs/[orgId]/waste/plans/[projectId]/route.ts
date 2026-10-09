export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import { LINK_ISSUERS } from "@/lib/evidence/submission-link";
import { wastePlanSchema } from "@/lib/waste/swmp";
import { loadWastePlan } from "@/lib/waste/swmp-load";

type Ctx = { params: Promise<{ orgId: string; projectId: string }> };

// GET: the project's Site Waste Management Plan with checks and actual-versus-forecast.
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, projectId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    const refs = await orgRefsError(orgId, { projectId });
    if (refs) return refs;
    return NextResponse.json(await loadWastePlan(orgId, projectId));
  } catch (err) {
    return handleRouteError(err);
  }
}

// PUT: create or change the plan. Changing an approved plan returns it to draft as the next version.
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, projectId } = await params;
    const { session } = await requireOrgMember(orgId, ...LINK_ISSUERS);
    const refs = await orgRefsError(orgId, { projectId });
    if (refs) return refs;
    const b = wastePlanSchema.parse(await req.json());
    const existing = await prisma.siteWastePlan.findFirst({ where: { organizationId: orgId, projectId }, select: { id: true, status: true, version: true } });
    const data = {
      responsiblePerson: b.responsiblePerson || null,
      principalContractor: b.principalContractor || null,
      clientName: b.clientName || null,
      targetDiversionPct: b.targetDiversionPct ?? null,
      actions: b.actions || null,
      nextReviewOn: b.nextReviewOn ? new Date(b.nextReviewOn) : null,
      lines: b.lines,
    };
    const plan = existing
      ? await prisma.siteWastePlan.update({
          where: { id: existing.id },
          data: { ...data, ...(existing.status === "approved" ? { status: "draft", version: existing.version + 1, approvedAt: null, approvedByUserId: null } : {}) },
          select: { id: true, status: true, version: true },
        })
      : await prisma.siteWastePlan.create({ data: { ...data, organizationId: orgId, projectId, createdByUserId: session.user.id }, select: { id: true, status: true, version: true } });
    await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: "waste_plan.saved", resourceType: "SiteWastePlan", resourceId: plan.id, metadata: { projectId, version: plan.version, lines: b.lines.length } });
    return NextResponse.json(plan, { status: existing ? 200 : 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
