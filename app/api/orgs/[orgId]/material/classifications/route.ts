export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import { classificationBody } from "@/lib/material/schemas";
import { evidenceIdsError, loadMaterial, MATERIAL_EDITORS } from "@/lib/material/server";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    const siteId = req.nextUrl.searchParams.get("siteId");
    if (siteId) {
      const bad = await orgRefsError(orgId, { siteId });
      if (bad) return bad;
    }
    return NextResponse.json({ data: (await loadMaterial(orgId, { siteId })).classifications });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...MATERIAL_EDITORS);
    const body = classificationBody.parse(await req.json());
    const bad = (await orgRefsError(orgId, { siteId: body.siteId, projectId: body.projectId })) ?? (await evidenceIdsError(orgId, body.evidenceFileIds));
    if (bad) return bad;
    const row = await prisma.materialClassification.create({
      data: {
        organizationId: orgId, name: body.name, materialKind: body.materialKind, description: body.description || null,
        siteId: body.siteId || null, projectId: body.projectId || null, ewcCode: body.ewcCode || null, hazardous: body.hazardous,
        hazardousProperties: body.hazardousProperties.map((p) => p.toUpperCase().replace(/\s/g, "")), labReference: body.labReference || null,
        classifiedBy: body.classifiedBy || null, classifiedOn: body.classifiedOn ?? null, plannedRoute: body.plannedRoute ?? null,
        estimatedTonnes: body.estimatedTonnes ?? null, evidenceFileIds: body.evidenceFileIds, notes: body.notes || null, createdByUserId: session.user.id,
      },
    });
    await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: "material.classification_saved", resourceType: "material_classification", resourceId: row.id, metadata: { name: row.name, kind: row.materialKind, created: true } });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
