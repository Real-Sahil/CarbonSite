import { prisma } from "@/lib/db";
import { glidepath, type GlidepathResult } from "./glidepath";
import { socialPhase, type SocialPhase } from "./social-phase";

// Everything the Executive Summary shows, read from DashboardAggregate and a few counts. Prisma runs
// on one connection per function instance, so each question is one grouped statement rather than
// many small ones. Aggregate rows are pinned the way lib/calculation/aggregate-filters.ts describes,
// so no figure is counted twice. Stored values are kg; the summary speaks tonnes.

export type SummaryPeriod = { id: string; label: string; startDate: Date; endDate: Date };

export type ExecutiveSummary = {
  hasData: boolean;
  totalTonnes: number | null;
  /** Percentage change on the prior comparable period, or null when there is none. */
  changePct: number | null;
  scopeTonnes: { scope1: number; scope2: number; scope3: number };
  hotspot: { label: string; sharePct: number; tonnes: number } | null;
  target: { hasTarget: boolean; baselineTonnes: number | null; targetTonnes: number | null; targetEnd: Date | null; result: GlidepathResult | null };
  needsYou: { pendingSubmissions: number; openReviews: number };
  socialPhase: SocialPhase;
};

type Row = {
  currentKg: string | null;
  priorKg: string | null;
  scope1Kg: string | null;
  scope2Kg: string | null;
  scope3Kg: string | null;
  hotspotLabel: string | null;
  hotspotKg: string | null;
  baselineKg: string | null;
  targetEnd: Date | null;
  baselineEnd: Date | null;
  reductionKg: string | null;
  pendingSubmissions: number;
  openReviews: number;
  fieldWorkers: number;
  imports: number;
  succeededRuns: number;
};

const kgToTonnes = (v: string | null): number => (v == null ? 0 : Number(v) / 1000);

/**
 * `prior` is the comparable earlier period (lib/dashboard/prior-period.ts) or null. Only an
 * `absolute` target feeds the glidepath: its level is the baseline total less `reduction_amount`
 * (kgCO2e), the same reading the Targets page uses.
 */
export async function loadExecutiveSummary(
  orgId: string,
  period: SummaryPeriod,
  prior: { id: string } | null,
  now: Date = new Date(),
): Promise<ExecutiveSummary> {
  const priorId = prior?.id ?? null;
  const [row] = await prisma.$queryRaw<Row[]>`
    WITH live AS (
      SELECT reporting_period_id, scope, emission_category_id, facility_id, total_co2e
      FROM dashboard_aggregates
      WHERE organization_id = ${orgId}
        AND snapshot_id IS NULL
        AND business_unit_id IS NULL
        AND (scope2_method IS NULL OR scope2_method = 'location_based')
    ),
    tgt AS (
      SELECT baseline_period_id, target_period_id, reduction_amount
      FROM reduction_targets
      WHERE organization_id = ${orgId} AND target_type = 'absolute'
      ORDER BY created_at DESC
      LIMIT 1
    ),
    hot AS (
      SELECT c.name, sum(l.total_co2e) AS kg
      FROM live l JOIN emission_categories c ON c.id = l.emission_category_id
      WHERE l.reporting_period_id = ${period.id} AND l.facility_id IS NULL
      GROUP BY c.name
      ORDER BY kg DESC
      LIMIT 1
    )
    SELECT
      (SELECT sum(total_co2e) FROM live WHERE reporting_period_id = ${period.id} AND emission_category_id IS NULL AND facility_id IS NULL)::text AS "currentKg",
      (SELECT sum(total_co2e) FROM live WHERE reporting_period_id = ${priorId} AND emission_category_id IS NULL AND facility_id IS NULL)::text AS "priorKg",
      (SELECT sum(total_co2e) FROM live WHERE reporting_period_id = ${period.id} AND emission_category_id IS NULL AND facility_id IS NULL AND scope = 1)::text AS "scope1Kg",
      (SELECT sum(total_co2e) FROM live WHERE reporting_period_id = ${period.id} AND emission_category_id IS NULL AND facility_id IS NULL AND scope = 2)::text AS "scope2Kg",
      (SELECT sum(total_co2e) FROM live WHERE reporting_period_id = ${period.id} AND emission_category_id IS NULL AND facility_id IS NULL AND scope = 3)::text AS "scope3Kg",
      (SELECT name FROM hot) AS "hotspotLabel",
      (SELECT kg FROM hot)::text AS "hotspotKg",
      (SELECT sum(total_co2e) FROM live WHERE reporting_period_id = (SELECT baseline_period_id FROM tgt) AND emission_category_id IS NULL AND facility_id IS NULL)::text AS "baselineKg",
      (SELECT p.end_date FROM reporting_periods p WHERE p.id = (SELECT target_period_id FROM tgt) AND p.organization_id = ${orgId}) AS "targetEnd",
      (SELECT p.end_date FROM reporting_periods p WHERE p.id = (SELECT baseline_period_id FROM tgt) AND p.organization_id = ${orgId}) AS "baselineEnd",
      (SELECT reduction_amount FROM tgt)::text AS "reductionKg",
      (SELECT count(*) FROM field_submissions WHERE organization_id = ${orgId} AND status IN ('pending', 'submitted', 'under_review', 'needs_info'))::int AS "pendingSubmissions",
      (SELECT count(*) FROM review_tasks WHERE organization_id = ${orgId} AND status = 'open')::int AS "openReviews",
      (SELECT count(*) FROM organization_memberships WHERE organization_id = ${orgId} AND role = 'field_worker')::int AS "fieldWorkers",
      (SELECT count(*) FROM import_batches WHERE organization_id = ${orgId})::int AS "imports",
      (SELECT count(*) FROM calculation_runs WHERE organization_id = ${orgId} AND status = 'succeeded')::int AS "succeededRuns"
  `;

  const hasTotal = row.currentKg != null;
  const totalTonnes = hasTotal ? kgToTonnes(row.currentKg) : null;
  const priorTonnes = row.priorKg != null ? kgToTonnes(row.priorKg) : null;
  const changePct =
    totalTonnes != null && priorTonnes != null && priorTonnes > 0 ? ((totalTonnes - priorTonnes) / priorTonnes) * 100 : null;

  const hotspotTonnes = kgToTonnes(row.hotspotKg);
  const hotspot =
    row.hotspotLabel && totalTonnes && totalTonnes > 0 && hotspotTonnes > 0
      ? { label: row.hotspotLabel, tonnes: hotspotTonnes, sharePct: (hotspotTonnes / totalTonnes) * 100 }
      : null;

  const baselineTonnes = row.baselineKg != null ? kgToTonnes(row.baselineKg) : null;
  const targetTonnes = baselineTonnes != null && row.reductionKg != null ? baselineTonnes - kgToTonnes(row.reductionKg) : null;
  const hasTarget = row.reductionKg != null;
  const result =
    baselineTonnes != null && targetTonnes != null && row.targetEnd && totalTonnes != null
      ? glidepath({
          baselineTonnes,
          targetTonnes,
          baselineEnd: row.baselineEnd ?? period.startDate,
          targetEnd: row.targetEnd,
          periodStart: period.startDate,
          periodEnd: period.endDate,
          actualTonnes: totalTonnes,
          now,
        })
      : null;

  return {
    hasData: hasTotal && (totalTonnes ?? 0) > 0,
    totalTonnes,
    changePct,
    scopeTonnes: { scope1: kgToTonnes(row.scope1Kg), scope2: kgToTonnes(row.scope2Kg), scope3: kgToTonnes(row.scope3Kg) },
    hotspot,
    target: { hasTarget, baselineTonnes, targetTonnes, targetEnd: row.targetEnd, result },
    needsYou: { pendingSubmissions: row.pendingSubmissions, openReviews: row.openReviews },
    socialPhase: socialPhase({
      sourcesConnected: row.fieldWorkers > 0 || row.imports > 0,
      firstDataProcessed: row.succeededRuns > 0,
      baselineRecorded: baselineTonnes != null,
      liveVariance: result != null,
    }),
  };
}
