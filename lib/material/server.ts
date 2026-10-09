import { siteScope } from "@/lib/project/scope";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation/api";
import { PLANT_EDITORS } from "@/lib/plant/roles";
import { classificationBlockers, movementChecks } from "./checks";
import type { KnownCarrier } from "@/lib/waste/duty-of-care";

export const MATERIAL_EDITORS = PLANT_EDITORS;

/** 404 when any evidence id is not the organisation's. */
export async function evidenceIdsError(orgId: string, ids: string[] | undefined | null) {
  if (!ids?.length) return null;
  const n = await prisma.evidenceFile.count({ where: { id: { in: ids }, organizationId: orgId } });
  return n === new Set(ids).size ? null : apiError("NOT_FOUND", "Evidence file not found in this organisation.", 404);
}

const num = (d: { toString(): string } | null) => (d == null ? null : Number(d));

export function classificationFacts(c: { status: string; materialKind: string; ewcCode: string | null; hazardous: boolean; labReference: string | null; evidenceFileIds: string[]; classifiedBy: string | null; classifiedOn: Date | null }) {
  return { status: c.status, materialKind: c.materialKind, ewcCode: c.ewcCode, hazardous: c.hazardous, labReference: c.labReference, evidenceCount: c.evidenceFileIds.length, classifiedBy: c.classifiedBy, classifiedOn: c.classifiedOn };
}

export async function loadMaterial(orgId: string, filters: { siteId?: string | null; siteIds?: string[] | null; status?: string | null } = {}) {
  const scope = siteScope(filters.siteId, filters.siteIds);
  const [classifications, movements, profiles, sites] = await Promise.all([
    prisma.materialClassification.findMany({ where: { organizationId: orgId, ...scope }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    prisma.materialMovement.findMany({
      where: { organizationId: orgId, ...scope, ...(filters.status ? { status: filters.status } : {}) },
      include: { classification: true },
      orderBy: [{ plannedOn: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
    prisma.supplierProfile.findMany({ where: { organizationId: orgId, wasteCarrierRegistration: { not: null } }, select: { wasteCarrierRegistration: true, wasteCarrierExpiresAt: true, supplierName: true } }),
    prisma.site.findMany({ where: { organizationId: orgId, ...(filters.siteIds ? { id: { in: filters.siteIds } } : {}) }, select: { id: true, name: true } }),
  ]);
  const known: KnownCarrier[] = profiles.map((p) => ({ registration: p.wasteCarrierRegistration!, expiresAt: p.wasteCarrierExpiresAt, name: p.supplierName }));
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const rows = movements.map((m) => {
    const c = m.classification;
    const check = movementChecks(
      {
        status: m.status, plannedOn: m.plannedOn, receivedOn: m.receivedOn, plannedTonnes: Number(m.plannedTonnes), ticketTonnes: num(m.ticketTonnes),
        destinationName: m.destinationName, destinationPermit: m.destinationPermit, destinationAuthorisedEwc: m.destinationAuthorisedEwc,
        carrierName: m.carrierName, carrierRegistration: m.carrierRegistration, carrierRegistrationExpiry: m.carrierRegistrationExpiry,
        vehicleRegistration: m.vehicleRegistration, noteReference: m.noteReference, returnedCopyDue: m.returnedCopyDue, returnedCopyOn: m.returnedCopyOn,
        evidenceCount: m.evidenceFileIds.length,
      },
      classificationFacts(c), known,
    );
    return { ...m, siteName: siteName.get(m.siteId) ?? null, classificationName: c.name, ewcCode: c.ewcCode, hazardous: c.hazardous, check };
  });
  return {
    sites: sites.sort((a, b) => a.name.localeCompare(b.name)),
    classifications: classifications.map((c) => ({ ...c, siteName: c.siteId ? siteName.get(c.siteId) ?? null : null, blockers: classificationBlockers(classificationFacts(c)) })),
    movements: rows,
  };
}
