export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import { movementBody } from "@/lib/material/schemas";
import { evidenceIdsError, loadMaterial, MATERIAL_EDITORS } from "@/lib/material/server";

type Params = { params: Promise<{ orgId: string }> };

const query = z.object({ siteId: z.string().max(64).optional(), status: z.enum(["planned", "dispatched", "received", "rejected", "cancelled"]).optional() });

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    const q = query.parse(Object.fromEntries(req.nextUrl.searchParams));
    if (q.siteId) {
      const bad = await orgRefsError(orgId, { siteId: q.siteId });
      if (bad) return bad;
    }
    return NextResponse.json({ data: (await loadMaterial(orgId, q)).movements });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...MATERIAL_EDITORS);
    const body = movementBody.parse(await req.json());
    const bad =
      (await orgRefsError(orgId, { siteId: body.siteId, projectId: body.projectId, facilityId: body.facilityId, classificationId: body.classificationId })) ??
      (await evidenceIdsError(orgId, body.evidenceFileIds));
    if (bad) return bad;
    const c = await prisma.materialClassification.findFirst({ where: { id: body.classificationId, organizationId: orgId }, select: { status: true, siteId: true, plannedRoute: true } });
    if (!c) return apiError("NOT_FOUND", "Classification not found.", 404);
    if (c.status === "withdrawn") return apiError("CLASSIFICATION_WITHDRAWN", "That classification is withdrawn.", 409);
    if (c.siteId && c.siteId !== body.siteId) return apiError("WRONG_SITE", "That classification belongs to a different site.", 422);

    // The load belongs to the site's project unless another was named.
    const site = await prisma.site.findFirst({ where: { id: body.siteId, organizationId: orgId }, select: { projectId: true } });
    const row = await prisma.materialMovement.create({
      data: {
        organizationId: orgId, siteId: body.siteId, projectId: body.projectId || site?.projectId || null, facilityId: body.facilityId || null, classificationId: body.classificationId,
        plannedOn: body.plannedOn, plannedTonnes: body.plannedTonnes, disposalRoute: body.disposalRoute ?? c.plannedRoute,
        destinationName: body.destinationName, destinationPermit: body.destinationPermit || null, destinationAuthorisedEwc: body.destinationAuthorisedEwc.filter(Boolean),
        carrierName: body.carrierName || null, carrierRegistration: body.carrierRegistration || null, carrierRegistrationExpiry: body.carrierRegistrationExpiry ?? null,
        vehicleRegistration: body.vehicleRegistration || null, noteReference: body.noteReference || null, haulDistanceKm: body.haulDistanceKm ?? null,
        returnedCopyDue: body.returnedCopyDue ?? null, evidenceFileIds: body.evidenceFileIds, notes: body.notes || null, createdByUserId: session.user.id,
      },
    });
    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id, action: "material.movement_saved", resourceType: "material_movement", resourceId: row.id,
      metadata: { classificationId: row.classificationId, plannedTonnes: Number(row.plannedTonnes), created: true },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
