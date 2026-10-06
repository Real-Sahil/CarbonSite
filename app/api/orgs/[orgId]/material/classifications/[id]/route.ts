export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import { classificationBlockers } from "@/lib/material/checks";
import { classificationPatch } from "@/lib/material/schemas";
import { classificationFacts, evidenceIdsError, MATERIAL_EDITORS } from "@/lib/material/server";

type Params = { params: Promise<{ orgId: string; id: string }> };

/**
 * Edit a classification, approve it, or withdraw it. Changing an approved
 * classification returns it to draft so it is approved again on its new facts.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, id } = await params;
    const { session } = await requireOrgMember(orgId, ...MATERIAL_EDITORS);
    const { action, ...body } = classificationPatch.parse(await req.json());
    const existing = await prisma.materialClassification.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) return apiError("NOT_FOUND", "Classification not found.", 404);
    const bad = (await orgRefsError(orgId, { siteId: body.siteId, projectId: body.projectId })) ?? (await evidenceIdsError(orgId, body.evidenceFileIds));
    if (bad) return bad;

    const { hazardousProperties, ...rest } = body;
    const edits = {
      ...rest,
      ...(hazardousProperties ? { hazardousProperties: hazardousProperties.map((p) => p.toUpperCase().replace(/\s/g, "")) } : {}),
    };
    const changed = Object.keys(body).length > 0;
    const next = { ...existing, ...edits };

    let status = existing.status;
    let approval: { approvedByUserId: string | null; approvedAt: Date | null } | object = {};
    if (action === "approve") {
      const blockers = classificationBlockers(classificationFacts({ ...next, evidenceFileIds: next.evidenceFileIds }));
      if (blockers.length) return apiError("CLASSIFICATION_INCOMPLETE", blockers.join(" "), 422, { blockers });
      status = "approved";
      approval = { approvedByUserId: session.user.id, approvedAt: new Date() };
    } else if (action === "withdraw") {
      status = "withdrawn";
    } else if (changed && existing.status === "approved") {
      status = "draft";
      approval = { approvedByUserId: null, approvedAt: null };
    }

    const row = await prisma.materialClassification.update({
      where: { id },
      data: {
        ...edits,
        ...(body.siteId !== undefined ? { siteId: body.siteId || null } : {}),
        ...(body.projectId !== undefined ? { projectId: body.projectId || null } : {}),
        status, ...approval,
      },
    });
    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id, action: "material.classification_saved", resourceType: "material_classification", resourceId: id,
      metadata: { name: row.name, status: row.status, action: action ?? "edit", changed: Object.keys(body) },
    });
    return NextResponse.json(row);
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Only a classification no load was ever planned against can be deleted; otherwise withdraw it. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, id } = await params;
    const { session } = await requireOrgMember(orgId, ...MATERIAL_EDITORS);
    const existing = await prisma.materialClassification.findFirst({ where: { id, organizationId: orgId }, select: { name: true } });
    if (!existing) return apiError("NOT_FOUND", "Classification not found.", 404);
    if (await prisma.materialMovement.count({ where: { classificationId: id, organizationId: orgId } })) {
      return apiError("REFERENCED_BY", "Loads are recorded against this classification. Withdraw it instead.", 409);
    }
    await prisma.materialClassification.deleteMany({ where: { id, organizationId: orgId } });
    await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: "material.classification_saved", resourceType: "material_classification", resourceId: id, metadata: { name: existing.name, deleted: true } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
