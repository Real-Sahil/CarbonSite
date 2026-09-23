import { prisma } from '@/lib/db';
import type { EmissionFactor, OrganizationEmissionFactor } from '@prisma/client';
import { areUnitsCompatible, isCurrencyUnit } from './units';

export interface CustomFactorInput {
  scope?: number;
  emissionCategoryId?: string;
  activityType?: string;
  geographyCountry?: string;
  geographyRegion?: string;
  effectiveStartDate?: string | null;
  effectiveEndDate?: string | null;
  inputUnit?: string;
  co2?: number;
  ch4?: number;
  n2o?: number;
  co2e?: number;
  uncertaintyRating?: string;
  usageNotes?: string;
  source?: string;
  version?: number;
}

/**
 * The org's own factors, loaded once per calculation chunk. Always filtered by
 * organizationId: another tenant's factor must never reach this org's run.
 */
export async function loadOrgCustomFactors(organizationId: string): Promise<OrganizationEmissionFactor[]> {
  return prisma.organizationEmissionFactor.findMany({
    where: { organizationId, OR: [{ co2e: { not: null } }, { co2: { not: null } }] },
  });
}

export type CustomFactorQuery = {
  organizationId: string;
  emissionCategoryId: string;
  /** The category's activity type. */
  activityType?: string | null;
  geographyCountry?: string | null;
  activityDate: Date;
  /** The record's normalized unit. */
  recordUnit: string;
  /** Fuel type, transport mode, refrigerant: matched against the factor's activity type. */
  matchHint?: string;
};

const unitFits = (factorUnit: string, recordUnit: string) =>
  factorUnit === recordUnit ||
  areUnitsCompatible(factorUnit, recordUnit) ||
  (isCurrencyUnit(factorUnit) && isCurrencyUnit(recordUnit));

/**
 * The org factor that applies to a record, or null to fall back to the run's
 * shared library. A factor applies when its category matches, its unit can
 * take the record's, its dates cover the activity, and any country or
 * activity type it names matches the record. The most specific applies; ties
 * go to the latest version. Pure, so the tenant check here is a second line
 * behind the loader's organizationId filter.
 */
export function pickCustomFactor(
  factors: OrganizationEmissionFactor[],
  q: CustomFactorQuery,
): { factor: OrganizationEmissionFactor; reason: string } | null {
  const hints = (q.matchHint ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
  let best: { factor: OrganizationEmissionFactor; score: number; reasons: string[] } | null = null;

  for (const f of factors) {
    if (f.organizationId !== q.organizationId) continue;
    if (f.emissionCategoryId !== q.emissionCategoryId) continue;
    if (f.co2e == null && f.co2 == null) continue;
    if (!unitFits(f.inputUnit, q.recordUnit)) continue;
    if (f.effectiveStartDate && f.effectiveStartDate > q.activityDate) continue;
    if (f.effectiveEndDate && f.effectiveEndDate < q.activityDate) continue;

    const reasons: string[] = [];
    let score = 0;
    if (f.geographyCountry) {
      if (f.geographyCountry !== q.geographyCountry) continue;
      score += 2;
      reasons.push(`geography ${f.geographyCountry}`);
    }
    if (f.activityType) {
      const type = f.activityType.toLowerCase();
      const byCategory = type === q.activityType?.toLowerCase();
      const byDetail = hints.some((h) => type.includes(h));
      if (!byCategory && !byDetail) continue;
      score += byDetail ? 2 : 1;
      reasons.push(`activity ${f.activityType}`);
    }

    if (
      !best ||
      score > best.score ||
      (score === best.score &&
        (f.version > best.factor.version ||
          (f.version === best.factor.version && f.createdAt > best.factor.createdAt)))
    ) {
      best = { factor: f, score, reasons };
    }
  }

  if (!best) return null;
  const detail = best.reasons.length ? `, ${best.reasons.join(", ")}` : "";
  return { factor: best.factor, reason: `organisation factor v${best.factor.version} (${best.factor.inputUnit}${detail})` };
}

/**
 * An org factor in the shape the calculation pipeline takes. `id` is the org
 * factor's id; callers must store it as organizationEmissionFactorId, never
 * as emissionFactorId.
 */
export function customFactorAsLibraryFactor(f: OrganizationEmissionFactor, factorLibraryId: string): EmissionFactor {
  return {
    id: f.id,
    factorLibraryId,
    externalId: null,
    scope: f.scope,
    emissionCategoryId: f.emissionCategoryId,
    activityType: f.activityType,
    geographyCountry: f.geographyCountry,
    geographyRegion: f.geographyRegion,
    effectiveStartDate: f.effectiveStartDate,
    effectiveEndDate: f.effectiveEndDate,
    inputUnit: f.inputUnit,
    co2: f.co2,
    ch4: f.ch4,
    n2o: f.n2o,
    co2e: f.co2e,
    biogenicCo2: null,
    uncertaintyRating: f.uncertaintyRating,
    usageNotes: f.usageNotes,
    priceBaseYear: null,
  };
}

export async function getOrgCustomFactorLibrary(organizationId: string, filters?: { scope?: number; categoryId?: string }) {
  return prisma.organizationEmissionFactor.findMany({
    where: {
      organizationId,
      ...(filters?.scope && { scope: filters.scope }),
      ...(filters?.categoryId && { emissionCategoryId: filters.categoryId }),
    },
    include: {
      emissionCategory: { select: { name: true, code: true } },
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: [{ scope: 'asc' }, { version: 'desc' }],
  });
}

export async function createCustomFactor(organizationId: string, data: CustomFactorInput, userId: string) {
  return prisma.organizationEmissionFactor.create({
    data: {
      organizationId,
      scope: data.scope as number,
      emissionCategoryId: data.emissionCategoryId,
      activityType: data.activityType,
      geographyCountry: data.geographyCountry,
      geographyRegion: data.geographyRegion,
      effectiveStartDate: data.effectiveStartDate ? new Date(data.effectiveStartDate) : undefined,
      effectiveEndDate: data.effectiveEndDate ? new Date(data.effectiveEndDate) : undefined,
      inputUnit: data.inputUnit as string,
      co2: data.co2,
      ch4: data.ch4,
      n2o: data.n2o,
      co2e: data.co2e,
      uncertaintyRating: data.uncertaintyRating,
      usageNotes: data.usageNotes,
      source: data.source || 'admin_manual',
      version: data.version || 1,
      createdByUserId: userId,
    },
  });
}

export async function updateCustomFactor(organizationId: string, factorId: string, data: CustomFactorInput) {
  // Create new version instead of updating
  const existing = await prisma.organizationEmissionFactor.findUnique({
    where: { id: factorId },
  });

  if (!existing || existing.organizationId !== organizationId) {
    throw Object.assign(new Error('Custom factor not found.'), { code: 'NOT_FOUND', status: 404 });
  }

  // Get next version
  const maxVersion = await prisma.organizationEmissionFactor.findFirst({
    where: {
      organizationId,
      scope: existing.scope,
      emissionCategoryId: existing.emissionCategoryId,
      activityType: existing.activityType,
      geographyCountry: existing.geographyCountry,
      geographyRegion: existing.geographyRegion,
      inputUnit: existing.inputUnit,
    },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const nextVersion = (maxVersion?.version || 0) + 1;

  return prisma.organizationEmissionFactor.create({
    data: {
      organizationId,
      scope: data.scope ?? existing.scope,
      emissionCategoryId: data.emissionCategoryId ?? existing.emissionCategoryId,
      activityType: data.activityType ?? existing.activityType,
      geographyCountry: data.geographyCountry ?? existing.geographyCountry,
      geographyRegion: data.geographyRegion ?? existing.geographyRegion,
      effectiveStartDate: data.effectiveStartDate ? new Date(data.effectiveStartDate) : existing.effectiveStartDate,
      effectiveEndDate: data.effectiveEndDate ? new Date(data.effectiveEndDate) : existing.effectiveEndDate,
      inputUnit: data.inputUnit ?? existing.inputUnit,
      co2: data.co2 ?? existing.co2,
      ch4: data.ch4 ?? existing.ch4,
      n2o: data.n2o ?? existing.n2o,
      co2e: data.co2e ?? existing.co2e,
      uncertaintyRating: data.uncertaintyRating ?? existing.uncertaintyRating,
      usageNotes: data.usageNotes ?? existing.usageNotes,
      source: existing.source,
      version: nextVersion,
      createdByUserId: existing.createdByUserId,
    },
  });
}

export async function deleteCustomFactor(organizationId: string, factorId: string) {
  const factor = await prisma.organizationEmissionFactor.findUnique({
    where: { id: factorId },
  });

  if (!factor || factor.organizationId !== organizationId) {
    throw Object.assign(new Error('Custom factor not found.'), { code: 'NOT_FOUND', status: 404 });
  }

  // Calculations are immutable and must keep pointing at the factor they used.
  const used = await prisma.emissionCalculation.count({ where: { organizationId, organizationEmissionFactorId: factorId } });
  if (used > 0) {
    throw Object.assign(
      new Error('This factor is used by existing calculations, so it cannot be deleted. Add a new version instead.'),
      { code: 'FACTOR_IN_USE', status: 409 },
    );
  }

  return prisma.organizationEmissionFactor.delete({
    where: { id: factorId },
  });
}
