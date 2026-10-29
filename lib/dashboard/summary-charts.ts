import { prisma } from "@/lib/db";

// Chart data for the Executive Summary: top categories for the period and scope totals per period.
// Reads the same live DashboardAggregate rows as loadExecutiveSummary (no snapshot copies, no
// business-unit split, location-based Scope 2 only), so the charts agree with the tiles. Values are kgCO2e.

export type SummaryCategoryBar = { name: string; scope: number; value: number };
export type SummaryTrendPoint = { label: string; scope1: number; scope2: number; scope3: number };
export type SummaryCharts = { categories: SummaryCategoryBar[]; trend: SummaryTrendPoint[] };

type Row = {
  kind: "cat" | "trend";
  name: string;
  scope: number;
  startDate: Date | null;
  kg: string;
};

const TOP_CATEGORIES = 8;

/** Pure shaping step, kept apart from the query so it can be tested. */
export function shapeSummaryCharts(rows: Row[], totalKg: number): SummaryCharts {
  const categories = rows
    .filter((r) => r.kind === "cat")
    .map((r) => ({ name: r.name, scope: r.scope, value: Number(r.kg) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  // Anything outside the top list shows as one bar, so the bars add up to the total.
  const other = totalKg - categories.reduce((sum, c) => sum + c.value, 0);
  if (categories.length > 0 && other > totalKg * 0.005) categories.push({ name: "Other categories", scope: 0, value: other });

  const byPeriod = new Map<string, { start: number; point: SummaryTrendPoint }>();
  for (const r of rows) {
    if (r.kind !== "trend") continue;
    const key = r.name;
    let entry = byPeriod.get(key);
    if (!entry) {
      entry = { start: r.startDate ? new Date(r.startDate).getTime() : 0, point: { label: r.name, scope1: 0, scope2: 0, scope3: 0 } };
      byPeriod.set(key, entry);
    }
    const kg = Number(r.kg);
    if (r.scope === 1) entry.point.scope1 += kg;
    if (r.scope === 2) entry.point.scope2 += kg;
    if (r.scope === 3) entry.point.scope3 += kg;
  }
  const trend = [...byPeriod.values()].sort((a, b) => a.start - b.start).map((e) => e.point);
  return { categories, trend };
}

export async function loadSummaryCharts(orgId: string, periodId: string, totalKg: number): Promise<SummaryCharts> {
  const rows = await prisma.$queryRaw<Row[]>`
    WITH live AS (
      SELECT reporting_period_id, scope, emission_category_id, facility_id, total_co2e
      FROM dashboard_aggregates
      WHERE organization_id = ${orgId}
        AND snapshot_id IS NULL
        AND business_unit_id IS NULL
        AND (scope2_method IS NULL OR scope2_method = 'location_based')
    ),
    cats AS (
      SELECT c.name, c.scope, sum(l.total_co2e) AS kg
      FROM live l JOIN emission_categories c ON c.id = l.emission_category_id
      WHERE l.reporting_period_id = ${periodId} AND l.facility_id IS NULL
      GROUP BY c.name, c.scope
      ORDER BY kg DESC
      LIMIT ${TOP_CATEGORIES}
    )
    SELECT 'cat' AS kind, name, scope, NULL::timestamptz AS "startDate", kg::text AS kg FROM cats
    UNION ALL
    SELECT 'trend' AS kind, p.label AS name, l.scope, p.start_date AS "startDate", sum(l.total_co2e)::text AS kg
    FROM live l JOIN reporting_periods p ON p.id = l.reporting_period_id AND p.organization_id = ${orgId}
    WHERE l.emission_category_id IS NULL AND l.facility_id IS NULL
    GROUP BY p.label, p.start_date, l.scope
  `;
  return shapeSummaryCharts(rows, totalKg);
}
