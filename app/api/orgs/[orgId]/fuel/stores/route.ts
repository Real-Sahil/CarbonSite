export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import { PLANT_EDITORS } from "@/lib/plant/roles";
import { storeBody } from "@/lib/fuel/schemas";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    const data = await prisma.fuelStore.findMany({ where: { organizationId: orgId }, orderBy: [{ active: "desc" }, { name: "asc" }] });
    return NextResponse.json({ data });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...PLANT_EDITORS);
    const body = storeBody.parse(await req.json());
    const bad = await orgRefsError(orgId, { siteId: body.siteId, projectId: body.projectId });
    if (bad) return bad;
    if (body.identifier) {
      const clash = await prisma.fuelStore.findFirst({ where: { organizationId: orgId, identifier: body.identifier }, select: { id: true } });
      if (clash) return apiError("DUPLICATE_IDENTIFIER", "A fuel store with that serial number or registration already exists.", 409);
    }
    const store = await prisma.fuelStore.create({
      data: {
        organizationId: orgId, name: body.name, kind: body.kind, fuelType: body.fuelType, capacityLitres: body.capacityLitres,
        ownership: body.ownership, identifier: body.identifier || null, bunded: body.bunded ?? null,
        lastInspectionOn: body.lastInspectionOn ?? null, siteId: body.siteId || null, projectId: body.projectId || null,
        onSiteFrom: body.onSiteFrom ?? null, onSiteTo: body.onSiteTo ?? null,
      },
    });
    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id, action: "fuel.store_saved",
      resourceType: "fuel_store", resourceId: store.id, metadata: { name: store.name, kind: store.kind, created: true },
    });
    return NextResponse.json(store, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
