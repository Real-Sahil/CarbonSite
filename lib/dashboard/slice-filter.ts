// Dashboard filters that DashboardAggregate cannot answer (supplier, month,
// scope): they read DashboardSlice, whose rows are one per distinct
// combination, so any subset sums each calculation once. The result has the
// shape the dashboard already renders from aggregates.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PRIMARY_SCOPE2_METHOD } from "@/lib/calculation/aggregate-filters";
import { supplierKey } from "@/lib/social-value/local-spend";
import { MONTH_PATTERN } from "@/lib/saved-views";

export type SliceFilter = { supplierKey?: string; from?: Date; to?: Date; scope?: 1 | 2 | 3 };

const monthStart = (v: string | undefined) =>
  v && MONTH_PATTERN.test(v) ? new Date(Date.UTC(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, 1)) : undefined;

/** The slice filters a request names; malformed values are dropped, none set gives null. */
export function parseSliceFilter(raw: { supplier?: string; from?: string; to?: string; scope?: string }): SliceFilter | null {
  const f: SliceFilter = {};
  const supplier = raw.supplier?.trim().slice(0, 64);
  const key = supplier ? supplierKey(supplier) : "";
  if (key) f.supplierKey = key;
  const from = monthStart(raw.from);
  if (from) f.from = from;
  const to = monthStart(raw.to);
  if (to) f.to = to;
  if (raw.scope === "1" || raw.scope === "2" || raw.scope === "3") f.scope = Number(raw.scope) as 1 | 2 | 3;
  return Object.keys(f).length ? f : null;
}

/** Live slices of one period, inside the organisation, under the chosen filters. */
export function sliceWhere(
  organizationId: string,
  reportingPeriodId: string,
  f: SliceFilter,
  facilityIds: string[] | null,
): Prisma.DashboardSliceWhereInput {
  return {
    organizationId,
    reportingPeriodId,
    snapshotId: null,
    ...PRIMARY_SCOPE2_METHOD,
    ...(facilityIds ? { facilityId: { in: facilityIds } } : {}),
    ...(f.scope ? { scope: f.scope } : {}),
    ...(f.supplierKey ? { supplierKey: { contains: f.supplierKey } } : {}),
    // A record with no date has no month, so a date filter leaves it out.
    ...(f.from || f.to ? { month: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } } : {}),
  };
}

type SliceRow = { scope: number; emissionCategoryId: string; facilityId: string | null; totalCo2e: unknown; recordCount: number };

/** Scope, category and facility totals of some slices (pure). */
export function summariseSlices(rows: SliceRow[]) {
  const scopes = new Map<number, { totalCo2e: number; recordCount: number }>();
  const categories = new Map<string, { scope: number; totalCo2e: number; recordCount: number }>();
  const facilities = new Map<string, { totalCo2e: number; recordCount: number }>();
  const add = <K,>(m: Map<K, { totalCo2e: number; recordCount: number }>, k: K, base: object, r: SliceRow) => {
    const e = m.get(k) ?? { ...base, totalCo2e: 0, recordCount: 0 };
    e.totalCo2e += Number(r.totalCo2e);
    e.recordCount += r.recordCount;
    m.set(k, e);
  };
  for (const r of rows) {
    add(scopes, r.scope, {}, r);
    add(categories, r.emissionCategoryId, { scope: r.scope }, r);
    if (r.facilityId) add(facilities, r.facilityId, {}, r);
  }
  return { scopes, categories, facilities };
}

/** The dashboard's aggregate-shaped data for a sliced view. */
export async function loadSliceView(orgId: string, periodId: string, f: SliceFilter, facilityIds: string[] | null) {
  const rows = await prisma.dashboardSlice.findMany({
    where: sliceWhere(orgId, periodId, f, facilityIds),
    select: { scope: true, emissionCategoryId: true, facilityId: true, totalCo2e: true, recordCount: true },
  });
  const { scopes, categories, facilities } = summariseSlices(rows);
  const topCategories = [...categories].sort((a, b) => b[1].totalCo2e - a[1].totalCo2e).slice(0, 5);
  const [categoryNames, facilityNames] = await Promise.all([
    prisma.emissionCategory.findMany({ where: { id: { in: topCategories.map(([id]) => id) } }, select: { id: true, name: true, scope: true } }),
    prisma.facility.findMany({ where: { organizationId: orgId, id: { in: [...facilities.keys()] } }, select: { id: true, name: true } }),
  ]);
  const catName = new Map(categoryNames.map((c) => [c.id, c]));
  const facName = new Map(facilityNames.map((x) => [x.id, x.name]));
  return {
    scopeAggregates: [...scopes].sort((a, b) => a[0] - b[0]).map(([scope, v]) => ({ scope, _sum: { totalCo2e: v.totalCo2e, recordCount: v.recordCount } })),
    topCategoryAggregates: topCategories.map(([id, v]) => ({
      id, scope: v.scope, totalCo2e: v.totalCo2e, recordCount: v.recordCount,
      emissionCategory: catName.has(id) ? { name: catName.get(id)!.name, scope: catName.get(id)!.scope } : null,
    })),
    facilityAggregates: [...facilities].map(([id, v]) => ({
      id, facilityId: id, totalCo2e: v.totalCo2e, recordCount: v.recordCount,
      facility: facName.has(id) ? { id, name: facName.get(id)! } : null,
    })),
  };
}
