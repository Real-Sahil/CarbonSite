import { prisma } from '@/lib/db';

export interface CustomFactorMatchCriteria {
  organizationId: string;
  scope: number;
  emissionCategoryId?: string;
  geographyCountry?: string;
  geographyRegion?: string;
  activityType?: string;
  effectiveDate?: Date;
  inputUnit: string;
}

export async function selectCustomFactor(criteria: CustomFactorMatchCriteria) {
  const { organizationId, scope, emissionCategoryId, geographyCountry, geographyRegion, activityType, effectiveDate, inputUnit } = criteria;

  // Query custom factors with fallback to more general matches
  const customFactor = await prisma.organizationEmissionFactor.findFirst({
    where: {
      organizationId,
      scope,
      ...(emissionCategoryId && { emissionCategoryId }),
      ...(geographyCountry && { geographyCountry }),
      ...(geographyRegion && { geographyRegion }),
      ...(activityType && { activityType }),
      inputUnit,
      ...(effectiveDate && {
        effectiveStartDate: { lte: effectiveDate },
        effectiveEndDate: { gte: effectiveDate },
      }),
    },
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
  });

  return customFactor;
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

export async function createCustomFactor(organizationId: string, data: any, userId: string) {
  return prisma.organizationEmissionFactor.create({
    data: {
      organizationId,
      scope: data.scope,
      emissionCategoryId: data.emissionCategoryId,
      activityType: data.activityType,
      geographyCountry: data.geographyCountry,
      geographyRegion: data.geographyRegion,
      effectiveStartDate: data.effectiveStartDate ? new Date(data.effectiveStartDate) : undefined,
      effectiveEndDate: data.effectiveEndDate ? new Date(data.effectiveEndDate) : undefined,
      inputUnit: data.inputUnit,
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

export async function updateCustomFactor(organizationId: string, factorId: string, data: any) {
  // Create new version instead of updating
  const existing = await prisma.organizationEmissionFactor.findUnique({
    where: { id: factorId },
  });

  if (!existing || existing.organizationId !== organizationId) {
    throw new Error('Custom factor not found or access denied');
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
    throw new Error('Custom factor not found or access denied');
  }

  return prisma.organizationEmissionFactor.delete({
    where: { id: factorId },
  });
}
