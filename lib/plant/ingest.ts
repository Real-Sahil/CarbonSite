import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { differenceReadings, snapshotCumulatives, type Iso15143Snapshot, type PeriodRow } from "./telematics";

export type TelematicsInput = { kind: "iso15143"; snapshot: Iso15143Snapshot } | { kind: "rows"; rows: PeriodRow[] };

export type IngestResult = {
  readingsCreated: number;
  duplicates: number;
  assetsRegistered: string[];
  /** First snapshot for a machine: stored as its starting point, no period yet. */
  baselines: number;
  skipped: string[];
};

/**
 * Stores telematics readings for the org's own plant. Machines are matched by
 * serial within the org only; an unknown serial is added to the register
 * (flagged) so no data is dropped. Re-sending the same data is a no-op.
 */
export async function ingestTelematics(orgId: string, input: TelematicsInput, source: string, actorUserId: string | null): Promise<IngestResult> {
  const snapshot = input.kind === "iso15143" ? snapshotCumulatives(input.snapshot) : null;
  const identities =
    input.kind === "iso15143"
      ? snapshot!.readings.map((r) => ({ serialNumber: r.serialNumber, name: r.name, make: r.make, model: r.model }))
      : input.rows.map((r) => ({ serialNumber: r.serialNumber, name: r.name ?? r.serialNumber, make: r.make, model: r.model }));
  const serials = [...new Set(identities.map((i) => i.serialNumber))];

  const known = await prisma.plantAsset.findMany({
    where: { organizationId: orgId, serialNumber: { in: serials } },
    select: { id: true, serialNumber: true },
  });
  const knownSerials = new Set(known.map((a) => a.serialNumber));
  const toRegister = serials
    .filter((s) => !knownSerials.has(s))
    .map((s) => identities.find((i) => i.serialNumber === s)!);
  if (toRegister.length) {
    await prisma.plantAsset.createMany({
      data: toRegister.map((i) => ({
        organizationId: orgId,
        serialNumber: i.serialNumber,
        name: i.name,
        make: i.make ?? null,
        model: i.model ?? null,
        autoRegistered: true,
      })),
      skipDuplicates: true,
    });
  }
  const assets = await prisma.plantAsset.findMany({
    where: { organizationId: orgId, serialNumber: { in: serials } },
    select: { id: true, serialNumber: true },
  });
  const assetId = new Map(assets.map((a) => [a.serialNumber!, a.id]));

  const rows: {
    organizationId: string; assetId: string; periodStart: Date; periodEnd: Date;
    operatingHours: number | null; idleHours: number | null; fuelLitres: number | null; idleFuelLitres?: number | null;
    cumulativeHours?: number | null; cumulativeIdleHours?: number | null; cumulativeFuelLitres?: number | null; source: string;
  }[] = [];
  let baselines = 0;

  if (input.kind === "iso15143") {
    for (const cur of snapshot!.readings) {
      const id = assetId.get(cur.serialNumber)!;
      const prev = await prisma.plantTelematicsReading.findFirst({
        where: { organizationId: orgId, assetId: id, periodEnd: { lt: cur.at }, cumulativeHours: { not: null } },
        orderBy: { periodEnd: "desc" },
        select: { periodEnd: true, cumulativeHours: true, cumulativeIdleHours: true, cumulativeFuelLitres: true },
      });
      const diff = differenceReadings(
        prev
          ? {
              at: prev.periodEnd,
              hours: prev.cumulativeHours != null ? Number(prev.cumulativeHours) : null,
              idleHours: prev.cumulativeIdleHours != null ? Number(prev.cumulativeIdleHours) : null,
              fuelLitres: prev.cumulativeFuelLitres != null ? Number(prev.cumulativeFuelLitres) : null,
            }
          : null,
        cur,
      );
      if (!diff) baselines++;
      rows.push({
        organizationId: orgId,
        assetId: id,
        periodStart: diff?.periodStart ?? cur.at,
        periodEnd: cur.at,
        operatingHours: diff?.operatingHours ?? null,
        idleHours: diff?.idleHours ?? null,
        fuelLitres: diff?.fuelLitres ?? null,
        cumulativeHours: cur.hours,
        cumulativeIdleHours: cur.idleHours,
        cumulativeFuelLitres: cur.fuelLitres,
        source,
      });
    }
  } else {
    for (const r of input.rows) {
      rows.push({
        organizationId: orgId,
        assetId: assetId.get(r.serialNumber)!,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        operatingHours: r.operatingHours ?? null,
        idleHours: r.idleHours ?? null,
        fuelLitres: r.fuelLitres ?? null,
        idleFuelLitres: r.idleFuelLitres ?? null,
        source,
      });
    }
  }

  const created = rows.length ? await prisma.plantTelematicsReading.createMany({ data: rows, skipDuplicates: true }) : { count: 0 };
  const result: IngestResult = {
    readingsCreated: created.count,
    duplicates: rows.length - created.count,
    assetsRegistered: toRegister.map((i) => i.serialNumber),
    baselines,
    skipped: snapshot?.skipped ?? [],
  };
  await writeAuditLog({
    organizationId: orgId,
    actorUserId,
    action: "plant.telematics_ingested",
    resourceType: "plant_telematics",
    resourceId: orgId,
    metadata: { source, ...result },
  });
  return result;
}
