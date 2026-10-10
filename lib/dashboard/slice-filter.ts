// Dashboard filters that DashboardAggregate cannot answer (supplier, month,
// scope): they read DashboardSlice, whose rows are one per distinct
// combination, so any subset sums each calculation once. The result has the
// shape the dashboard already renders from aggregates.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CATEGORY_BREAKDOWN_DIMENSIONS, PRIMARY_SCOPE2_METHOD } from "@/lib/calculation/aggregate-filters";
import { buildFlows } from "@/lib/charts/sankey";
import { supplierKey } from "@/lib/social-value/local-spend";
import { MONTH_PATTERN } from "@/lib/saved-views";

export type SliceFilter = { supplierKey?: string; from?: Date; to?: Date; scope?: 1 | 2 | 3; projectId?: string; socialValue?: boolean; categoryId?: string; facilityId?: string; siteId?: string };

/** Ids the filters resolve to inside the organisation: a project's sites, and the contracts that carry social value commitments. */
export type SliceRefs = { siteIds?: string[]; contractIds?: string[] };

const PLAIN_ID = /^[A-Za-z0-9_-]{1,64}$/;

const monthStart = (v: string | undefined) =>
  v && MONTH_PATTERN.test(v) ? new Date(Date.UTC(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, 1)) : undefined;

/** The slice filters a request names; malformed values are dropped, none set gives null. */
export function parseSliceFilter(raw: { supplier?: string; from?: string; to?: string; scope?: string; projectId?: string; sv?: string; categoryId?: string; facilityId?: string; siteId?: string }): SliceFilter | null {
  const f: SliceFilter = {};
  const supplier = raw.supplier?.trim().slice(0, 64);
  const key = supplier ? supplierKey(supplier) : "";
  if (key) f.supplierKey = key;
  const from = monthStart(raw.from);
  if (from) f.from = from;
  const to = monthStart(raw.to);
  if (to) f.to = to;
  if (raw.scope === "1" || raw.scope === "2" || raw.scope === "3") f.scope = Number(raw.scope) as 1 | 2 | 3;
  if (raw.projectId && /^[A-Za-z0-9_-]{1,64}$/.test(raw.projectId)) f.projectId = raw.projectId;
  if (raw.sv === "1") f.socialValue = true;
  // Clicking a chart element sets these (cross-filtering): plain ids only.
  if (raw.categoryId && PLAIN_ID.test(raw.categoryId)) f.categoryId = raw.categoryId;
  if (raw.facilityId && PLAIN_ID.test(raw.facilityId)) f.facilityId = raw.facilityId;
  // One project site, from a hero pin. Plain id; another organisation's id matches nothing (every read is inside the organisation).
  if (raw.siteId && PLAIN_ID.test(raw.siteId)) f.siteId = raw.siteId;
  return Object.keys(f).length ? f : null;
}

/**
 * Resolves the project and social value filters to site and contract ids, always
 * inside the organisation: a project of another organisation has no sites here,
 * so it matches nothing. Social value is a record-set filter (contracts with a
 * commitment that is not cancelled); its figures are never added to emissions.
 */
export async function resolveSliceRefs(orgId: string, f: SliceFilter): Promise<SliceRefs> {
  const refs: SliceRefs = {};
  if (f.projectId) {
    const sites = await prisma.site.findMany({ where: { organizationId: orgId, projectId: f.projectId }, select: { id: true } });
    refs.siteIds = sites.map((x) => x.id);
  }
  if (f.socialValue) {
    const rows = await prisma.svCommitment.findMany({
      where: { organizationId: orgId, contractId: { not: null }, status: { not: "cancelled" } },
      select: { contractId: true },
      distinct: ["contractId"],
    });
    refs.contractIds = rows.map((r) => r.contractId!);
  }
  return refs;
}

/** Live slices of one period, inside the organisation, under the chosen filters. */
export function sliceWhere(
  organizationId: string,
  reportingPeriodId: string | null,
  f: SliceFilter,
  facilityIds: string[] | null,
  refs: SliceRefs = {},
): Prisma.DashboardSliceWhereInput {
  return {
    organizationId,
    // null reads every period (the trend).
    ...(reportingPeriodId ? { reportingPeriodId } : {}),
    snapshotId: null,
    ...PRIMARY_SCOPE2_METHOD,
    // A chosen facility narrows inside any entity, country or contract scope, never beyond it.
    ...(f.facilityId
      ? { facilityId: facilityIds ? { in: facilityIds.filter((id) => id === f.facilityId) } : f.facilityId }
      : facilityIds
        ? { facilityId: { in: facilityIds } }
        : {}),
    ...(f.scope ? { scope: f.scope } : {}),
    ...(f.categoryId ? { emissionCategoryId: f.categoryId } : {}),
    // A chosen site narrows inside a project's sites, never beyond them.
    ...(f.siteId
      ? { siteId: refs.siteIds ? { in: refs.siteIds.filter((id) => id === f.siteId) } : f.siteId }
      : refs.siteIds
        ? { siteId: { in: refs.siteIds } }
        : {}),
    ...(refs.contractIds ? { contractId: { in: refs.contractIds } } : {}),
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

/**
 * The dashboard's slice-based data: aggregate-shaped scope, category and
 * facility totals for a sliced view, plus the flows behind the Sankey. With no
 * filter set it reads every live slice of the period, so the flows always match
 * the headline.
 */
export async function loadSliceView(orgId: string, periodId: string, f: SliceFilter, facilityIds: string[] | null) {
  const refs = await resolveSliceRefs(orgId, f);
  const rows = await prisma.dashboardSlice.findMany({
    where: sliceWhere(orgId, periodId, f, facilityIds, refs),
    select: { scope: true, emissionCategoryId: true, facilityId: true, totalCo2e: true, recordCount: true },
  });
  const { scopes, categories, facilities } = summariseSlices(rows);
  const [categoryNames, facilityNames] = await Promise.all([
    prisma.emissionCategory.findMany({ where: { id: { in: [...categories.keys()] } }, select: { id: true, name: true, scope: true } }),
    prisma.facility.findMany({ where: { organizationId: orgId, id: { in: [...facilities.keys()] } }, select: { id: true, name: true } }),
  ]);
  const catName = new Map(categoryNames.map((c) => [c.id, c]));
  const facName = new Map(facilityNames.map((x) => [x.id, x.name]));
  const topCategories = [...categories].sort((a, b) => b[1].totalCo2e - a[1].totalCo2e).slice(0, 5);
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
    names: {
      categories: Object.fromEntries(categoryNames.map((c) => [c.id, c.name])),
      facilities: Object.fromEntries(facilityNames.map((x) => [x.id, x.name])),
    },
    flows: buildFlows(rows, {
      category: (id) => catName.get(id)?.name ?? "Uncategorised",
      facility: (id) => facName.get(id) ?? "Unknown site",
    }),
  };
}

/** Category totals (kg) of two live periods, deduplicated across Scope 2 methods, for the change waterfall. */
export async function loadPeriodCategoryTotals(orgId: string, currentId: string, previousId: string) {
  const rows = await prisma.dashboardAggregate.findMany({
    where: {
      organizationId: orgId,
      snapshotId: null,
      reportingPeriodId: { in: [currentId, previousId] },
      ...CATEGORY_BREAKDOWN_DIMENSIONS,
    },
    select: { reportingPeriodId: true, emissionCategoryId: true, totalCo2e: true, emissionCategory: { select: { name: true } } },
  });
  const pick = (periodId: string) =>
    rows
      .filter((r) => r.reportingPeriodId === periodId && r.emissionCategoryId)
      .map((r) => ({ id: r.emissionCategoryId!, label: r.emissionCategory?.name ?? "Uncategorised", kg: Number(r.totalCo2e) }));
  return { current: pick(currentId), previous: pick(previousId) };
}

/**
 * Social value on the contracts a social value filter covers, shown beside the
 * emissions and never added to them. Monetised values are summed in GBP only;
 * commitments in another currency are counted but not summed.
 */
export async function socialValueBeside(orgId: string, contractIds: string[]) {
  const rows = await prisma.svCommitment.findMany({
    where: { organizationId: orgId, contractId: { in: contractIds }, status: { not: "cancelled" } },
    select: { monetisedValue: true, currency: true },
  });
  const gbp = rows.filter((r) => r.currency === "GBP" && r.monetisedValue != null);
  return {
    contracts: contractIds.length,
    commitments: rows.length,
    gbpValue: gbp.reduce((sum, r) => sum + Number(r.monetisedValue), 0),
    otherCurrency: rows.filter((r) => r.currency !== "GBP" && r.monetisedValue != null).length,
  };
}

/** Scope totals of one period under the filters, in the shape of the aggregate groupBy the dashboard already renders. */
export async function loadSliceScopes(orgId: string, periodId: string, f: SliceFilter, facilityIds: string[] | null) {
  const refs = await resolveSliceRefs(orgId, f);
  const rows = await prisma.dashboardSlice.groupBy({
    by: ["scope"],
    where: sliceWhere(orgId, periodId, f, facilityIds, refs),
    _sum: { totalCo2e: true, recordCount: true },
    orderBy: { scope: "asc" },
  });
  return rows.map((r) => ({ scope: r.scope, _sum: { totalCo2e: r._sum.totalCo2e == null ? null : String(r._sum.totalCo2e), recordCount: r._sum.recordCount } }));
}

/** Scope totals of every period under the filters, in the shape of the live aggregate rows the trend chart reads. */
export async function loadSliceTrend(orgId: string, f: SliceFilter, facilityIds: string[] | null) {
  const refs = await resolveSliceRefs(orgId, f);
  const rows = await prisma.dashboardSlice.groupBy({
    by: ["reportingPeriodId", "scope"],
    where: sliceWhere(orgId, null, f, facilityIds, refs),
    _sum: { totalCo2e: true },
  });
  const periods = await prisma.reportingPeriod.findMany({
    where: { organizationId: orgId, id: { in: [...new Set(rows.map((r) => r.reportingPeriodId))] } },
    select: { id: true, label: true, startDate: true },
  });
  const byId = new Map(periods.map((p) => [p.id, p]));
  return rows.flatMap((r) => {
    const period = byId.get(r.reportingPeriodId);
    return period ? [{ scope: r.scope, totalCo2e: r._sum.totalCo2e ?? 0, reportingPeriod: period }] : [];
  });
}
