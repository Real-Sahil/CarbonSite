export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { PLANT_EDITORS } from "@/lib/plant/roles";
import { assetBody } from "@/lib/plant/schemas";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    const assets = await prisma.plantAsset.findMany({
      where: { organizationId: orgId },
      include: { site: { select: { id: true, name: true } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
    return NextResponse.json({ data: assets });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...PLANT_EDITORS);
    const data = assetBody.parse(await req.json());
    if (data.siteId) {
      const site = await prisma.site.findFirst({ where: { id: data.siteId, organizationId: orgId }, select: { id: true } });
      if (!site) return apiError("NOT_FOUND", "Site not found.", 404);
    }
    if (data.serialNumber) {
      const clash = await prisma.plantAsset.findFirst({ where: { organizationId: orgId, serialNumber: data.serialNumber }, select: { id: true } });
      if (clash) return apiError("DUPLICATE_SERIAL", "A machine with that serial number is already registered.", 409);
    }
    const asset = await prisma.plantAsset.create({
      data: {
        organizationId: orgId,
        name: data.name,
        assetCode: data.assetCode || null,
        category: data.category || null,
        make: data.make || null,
        model: data.model || null,
        serialNumber: data.serialNumber || null,
        telematicsProvider: data.telematicsProvider || null,
        fuelType: data.fuelType,
        ownership: data.ownership,
        supplierName: data.supplierName || null,
        siteId: data.siteId || null,
        onHireFrom: data.onHireFrom ?? null,
        onHireTo: data.onHireTo ?? null,
      },
    });
    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id, action: "plant.asset_created",
      resourceType: "plant_asset", resourceId: asset.id, metadata: { name: asset.name, fuelType: asset.fuelType },
    });
    return NextResponse.json(asset, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
