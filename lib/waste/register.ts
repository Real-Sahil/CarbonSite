import { prisma } from "@/lib/db";
import { checkDutyOfCare, formatEwc, type DutyOfCareResult, type KnownCarrier } from "./duty-of-care";
import { wasteHierarchyOf } from "./hierarchy";

const DIVERTED = new Set(["recycle", "recovery"]);

export type RegisterFilters = { reportingPeriodId?: string; facilityId?: string; gapsOnly?: boolean };

export type RegisterRow = {
  id: string;
  recordedAt: Date;
  facility: string;
  wasteType: string;
  ewc: string | null;
  hazardous: boolean;
  tonnes: number;
  disposalRoute: string;
  carrierName: string | null;
  carrierRegistration: string | null;
  transferNoteReference: string | null;
  destination: string | null;
  vehicleRegistration: string | null;
  check: DutyOfCareResult;
};

/**
 * The org's waste transfers with duty-of-care checks, newest first, with
 * landfill diversion (recycling plus energy recovery) per site.
 */
export async function loadWasteRegister(orgId: string, filters: RegisterFilters, take = 2000) {
  const [records, profiles] = await Promise.all([
    prisma.wasteRecord.findMany({
      where: {
        organizationId: orgId,
        ...(filters.reportingPeriodId ? { reportingPeriodId: filters.reportingPeriodId } : {}),
        ...(filters.facilityId ? { facilityId: filters.facilityId } : {}),
      },
      orderBy: { recordedAt: "desc" },
      take,
      select: {
        id: true, recordedAt: true, wasteType: true, ewcCode: true, hazardous: true, weightTonnes: true,
        disposalRoute: true, carrierName: true, carrierRegistration: true, transferNoteReference: true,
        destination: true, vehicleRegistration: true,
        facility: { select: { id: true, name: true } },
      },
    }),
    prisma.supplierProfile.findMany({
      where: { organizationId: orgId, wasteCarrierRegistration: { not: null } },
      select: { wasteCarrierRegistration: true, wasteCarrierExpiresAt: true, supplierName: true },
    }),
  ]);

  const carriers: KnownCarrier[] = profiles.map((p) => ({
    registration: p.wasteCarrierRegistration!,
    expiresAt: p.wasteCarrierExpiresAt,
    name: p.supplierName,
  }));

  const all: RegisterRow[] = records.map((r) => {
    const check = checkDutyOfCare(r, carriers);
    return {
      id: r.id,
      recordedAt: r.recordedAt,
      facility: r.facility.name,
      wasteType: r.wasteType,
      ewc: check.ewcCode ? formatEwc(check.ewcCode) : r.ewcCode,
      hazardous: r.hazardous,
      tonnes: Number(r.weightTonnes),
      disposalRoute: r.disposalRoute,
      carrierName: r.carrierName,
      carrierRegistration: r.carrierRegistration,
      transferNoteReference: r.transferNoteReference,
      destination: r.destination,
      vehicleRegistration: r.vehicleRegistration,
      check,
    };
  });

  const bySite = new Map<string, { tonnes: number; diverted: number; transfers: number; gaps: number }>();
  for (const row of all) {
    const s = bySite.get(row.facility) ?? { tonnes: 0, diverted: 0, transfers: 0, gaps: 0 };
    s.tonnes += row.tonnes;
    if (DIVERTED.has(wasteHierarchyOf(row.disposalRoute))) s.diverted += row.tonnes;
    s.transfers += 1;
    if (!row.check.complete) s.gaps += 1;
    bySite.set(row.facility, s);
  }

  const rows = filters.gapsOnly ? all.filter((r) => !r.check.complete) : all;
  const complete = all.filter((r) => r.check.complete).length;
  const tonnes = all.reduce((t, r) => t + r.tonnes, 0);
  const diverted = [...bySite.values()].reduce((t, s) => t + s.diverted, 0);

  return {
    rows,
    summary: {
      transfers: all.length,
      complete,
      gaps: all.length - complete,
      tonnes,
      diversionRate: tonnes > 0 ? diverted / tonnes : null,
      truncated: records.length === take,
    },
    sites: [...bySite.entries()]
      .map(([name, s]) => ({ name, ...s, diversionRate: s.tonnes > 0 ? s.diverted / s.tonnes : null }))
      .sort((a, b) => b.tonnes - a.tonnes),
  };
}

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per transfer, in the order an inspector reads a register. */
export function registerToCsv(rows: RegisterRow[]): string {
  const header = [
    "Date", "Site", "Waste description", "EWC code", "Hazardous", "Tonnes", "Disposal route",
    "Carrier", "Carrier registration", "Transfer/consignment note", "Receiving site", "Vehicle",
    "Keep note until", "Complete", "Issues",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      r.recordedAt.toISOString().slice(0, 10), r.facility, r.wasteType, r.ewc, r.hazardous ? "yes" : "no",
      r.tonnes.toFixed(3), r.disposalRoute, r.carrierName, r.carrierRegistration, r.transferNoteReference,
      r.destination, r.vehicleRegistration, r.check.keepUntil.toISOString().slice(0, 10),
      r.check.complete ? "yes" : "no", r.check.issues.map((i) => i.message).join(" | "),
    ].map(cell).join(","));
  }
  return lines.join("\n");
}
