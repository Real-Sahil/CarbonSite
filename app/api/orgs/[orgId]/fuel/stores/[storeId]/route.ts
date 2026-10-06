export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import { PLANT_EDITORS } from "@/lib/plant/roles";
import { storePatch } from "@/lib/fuel/schemas";

type Params = { params: Promise<{ orgId: string; storeId: string }> };

/** Change a store, or retire it with `active: false`. A store with history is never deleted. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, storeId } = await params;
    const { session } = await requireOrgMember(orgId, ...PLANT_EDITORS);
    const body = storePatch.parse(await req.json());
    const existing = await prisma.fuelStore.findFirst({ where: { id: storeId, organizationId: orgId }, select: { id: true } });
    if (!existing) return apiError("NOT_FOUND", "Fuel store not found.", 404);
    const bad = await orgRefsError(orgId, { siteId: body.siteId, projectId: body.projectId });
    if (bad) return bad;
    if (body.identifier) {
      const clash = await prisma.fuelStore.findFirst({ where: { organizationId: orgId, identifier: body.identifier, NOT: { id: storeId } }, select: { id: true } });
      if (clash) return apiError("DUPLICATE_IDENTIFIER", "A fuel store with that serial number or registration already exists.", 409);
    }
    const { identifier, siteId, projectId, ...rest } = body;
    const store = await prisma.fuelStore.update({
      where: { id: storeId },
      data: {
        ...rest,
        ...(identifier !== undefined ? { identifier: identifier || null } : {}),
        ...(siteId !== undefined ? { siteId: siteId || null } : {}),
        ...(projectId !== undefined ? { projectId: projectId || null } : {}),
      },
    });
    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id, action: "fuel.store_saved",
      resourceType: "fuel_store", resourceId: store.id, metadata: { name: store.name, changed: Object.keys(body) },
    });
    return NextResponse.json(store);
  } catch (err) {
    return handleRouteError(err);
  }
}
