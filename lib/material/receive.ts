import { prisma } from "@/lib/db";
import { rebuildEnvironmentalMetricAggregates, syncWasteRecordCalculation } from "@/lib/calculation/environmental-metrics";
import { MATERIAL_KIND_LABELS, MATERIAL_KINDS } from "./schemas";

export type ReceiveInput = { receivedOn: Date; ticketTonnes: number; facilityId?: string | null; disposalRoute?: string | null };
export type ReceiveResult =
  | { ok: true; movementId: string; wasteRecordId: string; co2eTonnes: number | null; warning?: string }
  | { ok: false; code: string; message: string; status: number };

/**
 * Receipt of a load writes the existing WasteRecord (and, through it, the
 * s3-waste activity record and its calculation), so waste totals, ESRS E5 and
 * carbon come from the one pipeline. Idempotent: a load already received
 * returns its waste record.
 */
export async function receiveMovement(orgId: string, movementId: string, actorUserId: string, input: ReceiveInput): Promise<ReceiveResult> {
  const m = await prisma.materialMovement.findFirst({ where: { id: movementId, organizationId: orgId }, include: { classification: true } });
  if (!m) return { ok: false, code: "NOT_FOUND", message: "Load not found.", status: 404 };
  if (m.wasteRecordId) return { ok: true, movementId, wasteRecordId: m.wasteRecordId, co2eTonnes: null };
  if (m.status === "rejected" || m.status === "cancelled") return { ok: false, code: "CONFLICT", message: `A ${m.status} load cannot be received.`, status: 409 };

  const facilityId = input.facilityId ?? m.facilityId;
  if (!facilityId) return { ok: false, code: "FACILITY_REQUIRED", message: "Choose the facility this waste is booked to.", status: 422 };
  const facility = await prisma.facility.findFirst({ where: { id: facilityId, organizationId: orgId }, select: { id: true } });
  if (!facility) return { ok: false, code: "NOT_FOUND", message: "Facility not found.", status: 404 };
  const disposalRoute = input.disposalRoute ?? m.disposalRoute ?? m.classification.plannedRoute;
  if (!disposalRoute) return { ok: false, code: "ROUTE_REQUIRED", message: "Choose the disposal or recovery route for this load.", status: 422 };

  const period =
    (await prisma.reportingPeriod.findFirst({ where: { organizationId: orgId, startDate: { lte: input.receivedOn }, endDate: { gte: input.receivedOn } }, orderBy: { startDate: "desc" }, select: { id: true } })) ??
    (await prisma.reportingPeriod.findFirst({ where: { organizationId: orgId }, orderBy: { startDate: "desc" }, select: { id: true } }));
  if (!period) return { ok: false, code: "NO_REPORTING_PERIOD", message: "No reporting period is set up. Create one first.", status: 422 };

  const c = m.classification;
  const kind = (MATERIAL_KINDS as readonly string[]).includes(c.materialKind) ? MATERIAL_KIND_LABELS[c.materialKind as (typeof MATERIAL_KINDS)[number]] : c.materialKind;
  const wasteRecord = await prisma.$transaction(async (tx) => {
    const w = await tx.wasteRecord.create({
      data: {
        organizationId: orgId, facilityId, projectId: m.projectId, reportingPeriodId: period.id,
        wasteType: `${c.name} (${kind})`.slice(0, 100), disposalRoute, hazardous: c.hazardous, weightTonnes: input.ticketTonnes,
        ewcCode: c.ewcCode, carrierName: m.carrierName, carrierRegistration: m.carrierRegistration, transferNoteReference: m.noteReference,
        destination: m.destinationPermit ? `${m.destinationName} (${m.destinationPermit})` : m.destinationName, vehicleRegistration: m.vehicleRegistration,
        dataSource: "manual", recordedAt: input.receivedOn, notes: `From material movement ${m.id}`, createdByUserId: actorUserId,
      },
    });
    await tx.materialMovement.update({
      where: { id: m.id },
      data: { status: "received", receivedOn: input.receivedOn, ticketTonnes: input.ticketTonnes, facilityId, disposalRoute, wasteRecordId: w.id },
    });
    return w;
  });

  try {
    const calc = await syncWasteRecordCalculation(wasteRecord.id, actorUserId);
    await rebuildEnvironmentalMetricAggregates(orgId, period.id);
    return { ok: true, movementId, wasteRecordId: wasteRecord.id, co2eTonnes: calc?.co2eTonnes ?? null };
  } catch (err) {
    console.error("[material] waste calculation failed after receipt", err);
    return { ok: true, movementId, wasteRecordId: wasteRecord.id, co2eTonnes: null, warning: "The load is recorded, but its carbon calculation did not run. Run a calculation from the Calculations page." };
  }
}
