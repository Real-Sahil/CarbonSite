export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import { caseStudyBody } from "@/lib/case-studies";

type Ctx = { params: Promise<{ orgId: string; caseStudyId: string }> };

// PATCH /api/orgs/[orgId]/case-studies/[caseStudyId]
// The whole case study is sent again. The organisation is part of every
// lookup, so another organisation's id is simply not found.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, caseStudyId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const body = caseStudyBody.parse(await req.json());
    const bad = await orgRefsError(orgId, { contractId: body.contractId, evidenceFileId: body.photoEvidenceFileId });
    if (bad) return bad;

    const found = await prisma.caseStudy.updateMany({ where: { id: caseStudyId, organizationId: orgId }, data: body });
    if (found.count === 0) return apiError("NOT_FOUND", "Case study not found.", 404);

    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "case_study.updated", resourceType: "CaseStudy", resourceId: caseStudyId,
      metadata: { published: body.published, contractId: body.contractId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/orgs/[orgId]/case-studies/[caseStudyId]
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, caseStudyId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const gone = await prisma.caseStudy.deleteMany({ where: { id: caseStudyId, organizationId: orgId } });
    if (gone.count === 0) return apiError("NOT_FOUND", "Case study not found.", 404);

    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "case_study.deleted", resourceType: "CaseStudy", resourceId: caseStudyId, metadata: {},
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
