import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { convertBetween, normalizeUnit, UnitError } from "./units";
import { scope2MethodOf } from "./scope2-method";
import { allocateInstruments, type Allocation, type MarketRecordInput } from "./scope2-instruments";

/**
 * Allocation of the organisation's contractual instruments across every
 * market-based electricity record in a run. Rebuilt identically on every
 * chunk of the run, so volume-limited certificates are never double-claimed
 * however the run is split.
 */
export async function loadMarketAllocations(
  orgId: string,
  recordWhere: Prisma.ActivityRecordWhereInput,
): Promise<Map<string, Allocation>> {
  const instruments = await prisma.energyInstrument.findMany({ where: { organizationId: orgId } });
  if (instruments.length === 0) return new Map();

  const records = await prisma.activityRecord.findMany({
    where: { ...recordWhere, emissionCategory: { scope: 2 } },
    select: {
      id: true,
      facilityId: true,
      activityDate: true,
      startDate: true,
      amount: true,
      unit: true,
      scope2Method: true,
      emissionCategory: { select: { scope: true, code: true } },
    },
  });

  const market: MarketRecordInput[] = [];
  for (const r of records) {
    if (scope2MethodOf(r) !== "market_based") continue;
    const date = r.activityDate ?? r.startDate;
    if (!date) continue;
    let kwh: number | null = null;
    try {
      const normalized = normalizeUnit(Number(r.amount), r.unit);
      kwh = convertBetween(normalized.amount, normalized.unit, "kWh");
    } catch (err) {
      if (!(err instanceof UnitError)) throw err;
    }
    if (kwh == null) continue;
    market.push({ id: r.id, facilityId: r.facilityId, activityDate: date, kwh });
  }

  return allocateInstruments(
    market,
    instruments.map((i) => ({
      id: i.id,
      type: i.type,
      facilityId: i.facilityId,
      coveredKwh: i.coveredKwh == null ? null : Number(i.coveredKwh),
      factorKgPerKwh: Number(i.emissionFactorKgPerKwh),
      validFrom: i.validFrom,
      validTo: i.validTo,
      reference: i.reference,
      supplierName: i.supplierName,
    })),
  );
}
