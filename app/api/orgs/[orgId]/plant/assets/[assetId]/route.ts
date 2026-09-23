export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { PLANT_EDITORS } from "@/lib/plant/roles";
import { assetBody } from "@/lib/plant/schemas";

type Params = { params: Promise<{ orgId: string; assetId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, assetId } = await params;
    const { session } = await requireOrgMember(orgId, ...PLANT_EDITORS);
    const existing = await prisma.plantAsset.findFirst({ where: { id: assetId, organizationId: orgId }, select: { id: true } });
    if (!existing) return apiError("NOT_FOUND", "Machine not found.", 404);

    const data = assetBody.partial().parse(await req.json());
    if (data.siteId) {
      const site = await prisma.site.findFirst({ where: { id: data.siteId, organizationId: orgId }, select: { id: true } });
      if (!site) return apiError("NOT_FOUND", "Site not found.", 404);
    }
    if (data.serialNumber) {
      const clash = await prisma.plantAsset.findFirst({
        where: { organizationId: orgId, serialNumber: data.serialNumber, id: { not: assetId } },
        select: { id: true },
      });
      if (clash) return apiError("DUPLICATE_SERIAL", "A machine with that serial number is already registered.", 409);
    }
    const nullable = (v: string | null | undefined) => (v === undefined ? undefined : v || null);
    const asset = await prisma.plantAsset.update({
      where: { id: assetId },
      data: {
        name: data.name,
        assetCode: nullable(data.assetCode),
        category: nullable(data.category),
        make: nullable(data.make),
        model: nullable(data.model),
        serialNumber: nullable(data.serialNumber),
        telematicsProvider: nullable(data.telematicsProvider),
        fuelType: data.fuelType,
        ownership: data.ownership,
        supplierName: nullable(data.supplierName),
        siteId: nullable(data.siteId),
        onHireFrom: data.onHireFrom,
        onHireTo: data.onHireTo,
        active: data.active,
        // Confirming a machine the feed added clears the flag.
        autoRegistered: false,
      },
    });
    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id, action: "plant.asset_updated",
      resourceType: "plant_asset", resourceId: asset.id, metadata: { changed: Object.keys(data) },
    });
    return NextResponse.json(asset);
  } catch (err) {
    return handleRouteError(err);
  }
}
