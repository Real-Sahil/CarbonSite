export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import { movementPatch } from "@/lib/material/schemas";
import { receiveMovement } from "@/lib/material/receive";
import { evidenceIdsError, MATERIAL_EDITORS } from "@/lib/material/server";

type Params = { params: Promise<{ orgId: string; id: string }> };

/**
 * One load's lifecycle: edit its details, dispatch it (only once its
 * classification is approved), receive it (writes the waste record), reject it
 * or cancel it.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, id } = await params;
    const { session } = await requireOrgMember(orgId, ...MATERIAL_EDITORS);
    const { action, receivedOn, ticketTonnes, returnedCopyOn, rejectionReason, ...fields } = movementPatch.parse(await req.json());
    const m = await prisma.materialMovement.findFirst({ where: { id, organizationId: orgId }, include: { classification: { select: { status: true } } } });
    if (!m) return apiError("NOT_FOUND", "Load not found.", 404);
    const audit = (metadata: Record<string, string | number | string[] | null>, act: "material.movement_saved" | "material.movement_status" = "material.movement_status") =>
      writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: act, resourceType: "material_movement", resourceId: id, metadata });

    if (action === "receive") {
      if (receivedOn == null || ticketTonnes == null) return apiError("VALIDATION_ERROR", "Enter the date received and the weighbridge ticket weight.", 422);
      const bad = await orgRefsError(orgId, { facilityId: fields.facilityId });
      if (bad) return bad;
      const r = await receiveMovement(orgId, id, session.user.id, { receivedOn, ticketTonnes, facilityId: fields.facilityId, disposalRoute: fields.disposalRoute });
      if (!r.ok) return apiError(r.code, r.message, r.status);
      await audit({ to: "received", wasteRecordId: r.wasteRecordId, ticketTonnes });
      return NextResponse.json({ id, status: "received", wasteRecordId: r.wasteRecordId, co2eTonnes: r.co2eTonnes, warning: r.warning });
    }

    if (m.status === "received" && (action === "dispatch" || action === "reject" || action === "cancel")) {
      return apiError("CONFLICT", "A received load cannot be changed that way. Its waste record exists.", 409);
    }
    if ((m.status === "rejected" || m.status === "cancelled") && action !== "update") return apiError("CONFLICT", `The load is already ${m.status}.`, 409);

    if (action === "dispatch") {
      if (m.classification.status !== "approved") return apiError("CLASSIFICATION_NOT_APPROVED", "The material is not classified and approved. Approve its classification before the load moves.", 409);
      await prisma.materialMovement.update({ where: { id }, data: { status: "dispatched", dispatchedAt: new Date() } });
      await audit({ to: "dispatched" });
      return NextResponse.json({ id, status: "dispatched" });
    }
    if (action === "reject") {
      if (!rejectionReason) return apiError("VALIDATION_ERROR", "Say why the load was rejected.", 422);
      await prisma.materialMovement.update({ where: { id }, data: { status: "rejected", rejectionReason } });
      await audit({ to: "rejected", reason: rejectionReason });
      return NextResponse.json({ id, status: "rejected" });
    }
    if (action === "cancel") {
      await prisma.materialMovement.update({ where: { id }, data: { status: "cancelled" } });
      await audit({ to: "cancelled" });
      return NextResponse.json({ id, status: "cancelled" });
    }

    // update
    const bad = (await orgRefsError(orgId, { projectId: fields.projectId, facilityId: fields.facilityId })) ?? (await evidenceIdsError(orgId, fields.evidenceFileIds));
    if (bad) return bad;
    const { destinationAuthorisedEwc, ...rest } = fields;
    const row = await prisma.materialMovement.update({
      where: { id },
      data: {
        ...rest,
        ...(destinationAuthorisedEwc ? { destinationAuthorisedEwc: destinationAuthorisedEwc.filter(Boolean) } : {}),
        ...(returnedCopyOn !== undefined ? { returnedCopyOn } : {}),
        ...(ticketTonnes !== undefined && m.status !== "received" ? { ticketTonnes } : {}),
      },
    });
    // A received load's waste record carries the same duty-of-care details; keep them in step.
    if (row.wasteRecordId) {
      await prisma.wasteRecord.updateMany({
        where: { id: row.wasteRecordId, organizationId: orgId },
        data: {
          carrierName: row.carrierName, carrierRegistration: row.carrierRegistration, transferNoteReference: row.noteReference,
          vehicleRegistration: row.vehicleRegistration, destination: row.destinationPermit ? `${row.destinationName} (${row.destinationPermit})` : row.destinationName,
        },
      });
    }
    await audit({ changed: Object.keys({ ...fields, ...(returnedCopyOn !== undefined ? { returnedCopyOn } : {}) }) }, "material.movement_saved");
    return NextResponse.json(row);
  } catch (err) {
    return handleRouteError(err);
  }
}

/** A load that never moved can be deleted; once dispatched it is cancelled or rejected so the record stays. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, id } = await params;
    const { session } = await requireOrgMember(orgId, ...MATERIAL_EDITORS);
    const m = await prisma.materialMovement.findFirst({ where: { id, organizationId: orgId }, select: { status: true, plannedTonnes: true } });
    if (!m) return apiError("NOT_FOUND", "Load not found.", 404);
    if (m.status !== "planned" && m.status !== "cancelled") return apiError("CONFLICT", "Only a planned or cancelled load can be deleted.", 409);
    await prisma.materialMovement.deleteMany({ where: { id, organizationId: orgId, status: { in: ["planned", "cancelled"] } } });
    await writeAuditLog({ organizationId: orgId, actorUserId: session.user.id, action: "material.movement_deleted", resourceType: "material_movement", resourceId: id, metadata: { plannedTonnes: Number(m.plannedTonnes), status: m.status } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
