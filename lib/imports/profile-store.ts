// Database side of ERP export profiles: rows <-> ProfileSpec, always scoped
// to the organisation in the WHERE clause.

import type { ImportProfile, ImportProfileRule, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { profileSpecSchema, type ProfileSpec } from "./profiles";

type ProfileWithRules = ImportProfile & { rules: ImportProfileRule[] };

export function specFromRows(p: ProfileWithRules): ProfileSpec {
  return profileSpecSchema.parse({
    sourceSystem: p.sourceSystem,
    columns: p.columns,
    dateFormat: p.dateFormat,
    numberFormat: p.numberFormat,
    defaultCurrency: p.defaultCurrency,
    rules: [...p.rules]
      .sort((a, b) => a.position - b.position)
      .map((r) => ({
        account: r.account ?? undefined,
        costCode: r.costCode ?? undefined,
        action: r.action,
        categoryCode: r.categoryCode ?? undefined,
        basis: r.basis,
        unit: r.unit ?? undefined,
        industryCode: r.industryCode ?? undefined,
        fuelType: r.fuelType ?? undefined,
        facilityName: r.facilityName ?? undefined,
        note: r.note ?? undefined,
      })),
  });
}

export async function loadProfile(orgId: string, profileId: string) {
  const p = await prisma.importProfile.findFirst({ where: { id: profileId, organizationId: orgId }, include: { rules: true } });
  return p ? { id: p.id, name: p.name, updatedAt: p.updatedAt, spec: specFromRows(p) } : null;
}

/** Category codes in the spec that are not seeded. A code that is not seeded matches nothing, so it is refused at save. */
export async function unknownCategoryCodes(spec: ProfileSpec): Promise<string[]> {
  const codes = [...new Set(spec.rules.map((r) => r.categoryCode).filter((c): c is string => !!c))];
  if (codes.length === 0) return [];
  const found = await prisma.emissionCategory.findMany({ where: { code: { in: codes } }, select: { code: true } });
  const known = new Set(found.map((c) => c.code));
  return codes.filter((c) => !known.has(c));
}

function ruleRows(orgId: string, profileId: string, spec: ProfileSpec): Prisma.ImportProfileRuleCreateManyInput[] {
  return spec.rules.map((r, position) => ({
    organizationId: orgId,
    importProfileId: profileId,
    position,
    account: r.account ?? null,
    costCode: r.costCode ?? null,
    action: r.action,
    categoryCode: r.action === "include" ? (r.categoryCode ?? null) : null,
    basis: r.basis,
    unit: r.unit ?? null,
    industryCode: r.industryCode ?? null,
    fuelType: r.fuelType ?? null,
    facilityName: r.facilityName ?? null,
    note: r.note ?? null,
  }));
}

const header = (spec: ProfileSpec) => ({
  sourceSystem: spec.sourceSystem,
  columns: spec.columns,
  dateFormat: spec.dateFormat,
  numberFormat: spec.numberFormat,
  defaultCurrency: spec.defaultCurrency,
});

export async function createProfile(orgId: string, name: string, spec: ProfileSpec) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.importProfile.create({ data: { organizationId: orgId, name, ...header(spec) } });
    if (spec.rules.length) await tx.importProfileRule.createMany({ data: ruleRows(orgId, p.id, spec) });
    return p;
  });
}

/** Replaces the profile's columns and its whole rule table. Returns null when the profile is not the org's. */
export async function updateProfile(orgId: string, profileId: string, name: string, spec: ProfileSpec) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.importProfile.updateMany({ where: { id: profileId, organizationId: orgId }, data: { name, ...header(spec) } });
    if (updated.count === 0) return null;
    await tx.importProfileRule.deleteMany({ where: { importProfileId: profileId, organizationId: orgId } });
    if (spec.rules.length) await tx.importProfileRule.createMany({ data: ruleRows(orgId, profileId, spec) });
    return tx.importProfile.findFirst({ where: { id: profileId, organizationId: orgId } });
  });
}
