export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import { caseStudyBody } from "@/lib/case-studies";

// GET /api/orgs/[orgId]/case-studies
export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    const caseStudies = await prisma.caseStudy.findMany({ where: { organizationId: orgId }, orderBy: { updatedAt: "desc" } });
    return NextResponse.json({ caseStudies });
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/orgs/[orgId]/case-studies
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const body = caseStudyBody.parse(await req.json());
    const bad = await orgRefsError(orgId, { contractId: body.contractId });
    if (bad) return bad;

    const created = await prisma.caseStudy.create({
      data: { ...body, organizationId: orgId, createdByUserId: session.user.id },
    });
    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "case_study.created", resourceType: "CaseStudy", resourceId: created.id,
      metadata: { published: created.published, contractId: created.contractId },
    });
    return NextResponse.json({ caseStudy: created }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
