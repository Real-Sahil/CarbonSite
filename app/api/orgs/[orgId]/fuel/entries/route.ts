export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import { PLANT_EDITORS } from "@/lib/plant/roles";
import { entryBody, monthRange } from "@/lib/fuel/schemas";
import { loadFuel } from "@/lib/fuel/load";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    const q = req.nextUrl.searchParams;
    const { month, from, to } = monthRange(q.get("month"));
    const siteId = q.get("siteId");
    if (siteId) {
      const bad = await orgRefsError(orgId, { siteId });
      if (bad) return bad;
    }
    const { entries, stores, machines, sites } = await loadFuel(orgId, from, to, siteId);
    return NextResponse.json({ month, entries, stores, machines, sites });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** A delivery into a store, an issue from it to a machine, or a measured dip. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...PLANT_EDITORS);
    const body = entryBody.parse(await req.json());
    const bad = await orgRefsError(orgId, {
      fuelStoreId: body.storeId,
      plantAssetId: body.kind === "issue" ? body.plantAssetId : null,
      evidenceFileId: body.kind === "delivery" ? body.evidenceFileId : null,
    });
    if (bad) return bad;
    const store = await prisma.fuelStore.findFirst({ where: { id: body.storeId, organizationId: orgId }, select: { active: true } });
    if (!store?.active) return apiError("STORE_RETIRED", "That fuel store is retired. Reactivate it to record against it.", 409);

    const base = { organizationId: orgId, storeId: body.storeId, note: body.note || null, createdByUserId: session.user.id };
    let id: string;
    if (body.kind === "delivery") {
      id = (await prisma.fuelDelivery.create({
        data: { ...base, deliveredOn: body.on, fuelType: body.fuelType, litres: body.litres, supplierName: body.supplierName || null, reference: body.reference || null, evidenceFileId: body.evidenceFileId || null },
      })).id;
    } else if (body.kind === "issue") {
      id = (await prisma.fuelIssue.create({
        data: { organizationId: orgId, storeId: body.storeId, note: body.note || null, issuedByUserId: session.user.id, issuedOn: body.on, litres: body.litres, plantAssetId: body.plantAssetId || null, vehicleLabel: body.vehicleLabel || null, meterReading: body.meterReading ?? null },
      })).id;
    } else {
      id = (await prisma.fuelDip.create({ data: { ...base, dippedOn: body.on, litres: body.litres } })).id;
    }
    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id, action: "fuel.entry_added",
      resourceType: `fuel_${body.kind}`, resourceId: id, metadata: { storeId: body.storeId, litres: body.litres, on: body.on.toISOString().slice(0, 10) },
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

const deleteQuery = z.object({ kind: z.enum(["delivery", "issue", "dip"]), id: z.string().min(1) });

/** Remove a wrong entry. The audit log keeps what was removed. */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...PLANT_EDITORS);
    const { kind, id } = deleteQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
    const where = { id, organizationId: orgId };
    const row = kind === "delivery" ? await prisma.fuelDelivery.findFirst({ where }) : kind === "issue" ? await prisma.fuelIssue.findFirst({ where }) : await prisma.fuelDip.findFirst({ where });
    if (!row) return apiError("NOT_FOUND", "Entry not found.", 404);
    if (kind === "delivery") await prisma.fuelDelivery.delete({ where: { id } });
    else if (kind === "issue") await prisma.fuelIssue.delete({ where: { id } });
    else await prisma.fuelDip.delete({ where: { id } });
    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id, action: "fuel.entry_deleted",
      resourceType: `fuel_${kind}`, resourceId: id, metadata: { storeId: row.storeId, litres: Number(row.litres) },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
