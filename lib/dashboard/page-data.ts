import { prisma } from "@/lib/db";

// The dashboard used to issue one query per figure. Prisma runs on a single
// connection per function instance (lib/db), so those queries ran one after
// another and the page paid a database round trip for each. These loaders
// answer the same questions in one statement each. Every subquery is scoped
// to the organisation.

export type DashboardCounts = {
  records: number;
  approvedRecords: number;
  approvedWithoutEvidence: number;
  pendingAttention: number;
  imports: number;
  failedImports: number;
  failedCalculations: number;
  openReviewTasks: number;
  targets: number;
  initiatives: number;
  evidenceFiles: number;
  sites: number;
  fieldWorkers: number;
};

export async function loadDashboardCounts(orgId: string): Promise<DashboardCounts> {
  const [row] = await prisma.$queryRaw<DashboardCounts[]>`
    SELECT
      (SELECT count(*) FROM activity_records WHERE organization_id = ${orgId})::int AS "records",
      (SELECT count(*) FROM activity_records WHERE organization_id = ${orgId} AND review_status = 'approved')::int AS "approvedRecords",
      (SELECT count(*) FROM activity_records ar
         WHERE ar.organization_id = ${orgId} AND ar.review_status = 'approved'
           AND NOT EXISTS (SELECT 1 FROM activity_record_evidence e WHERE e.activity_record_id = ar.id))::int AS "approvedWithoutEvidence",
      (SELECT count(*) FROM activity_records WHERE organization_id = ${orgId} AND review_status IN ('in_review', 'draft'))::int AS "pendingAttention",
      (SELECT count(*) FROM import_batches WHERE organization_id = ${orgId})::int AS "imports",
      (SELECT count(*) FROM import_batches WHERE organization_id = ${orgId} AND state IN ('failed', 'needs_attention'))::int AS "failedImports",
      (SELECT count(*) FROM calculation_runs WHERE organization_id = ${orgId} AND status = 'failed')::int AS "failedCalculations",
      (SELECT count(*) FROM review_tasks WHERE organization_id = ${orgId} AND status = 'open')::int AS "openReviewTasks",
      (SELECT count(*) FROM reduction_targets WHERE organization_id = ${orgId})::int AS "targets",
      (SELECT count(*) FROM reduction_initiatives WHERE organization_id = ${orgId})::int AS "initiatives",
      (SELECT count(*) FROM evidence_files WHERE organization_id = ${orgId})::int AS "evidenceFiles",
      (SELECT count(*) FROM sites WHERE organization_id = ${orgId})::int AS "sites",
      (SELECT count(*) FROM organization_memberships WHERE organization_id = ${orgId} AND role = 'field_worker')::int AS "fieldWorkers"
  `;
  return row;
}

export type LatestRunStats = {
  runId: string;
  finishedAt: Date | null;
  reportingPeriodId: string;
  calculationCount: number;
  zeroCo2eCount: number;
  /** Of those, records that matched no factor at all (no library factor and no organisation factor). */
  noFactorCount: number;
  totalCo2e: number;
  approvedCo2e: number;
  fallbackCo2e: number;
  recordsAddedSince: number;
};

/**
 * The organisation's latest succeeded calculation run and the data quality
 * figures read from its calculations, or null when no run has succeeded.
 * "Fallback" matches the selection reason case-insensitively, as before.
 */
export async function loadLatestRunStats(orgId: string): Promise<LatestRunStats | null> {
  const rows = await prisma.$queryRaw<
    Array<Omit<LatestRunStats, "totalCo2e" | "approvedCo2e" | "fallbackCo2e"> & {
      totalCo2e: string | null;
      approvedCo2e: string | null;
      fallbackCo2e: string | null;
    }>
  >`
    WITH r AS (
      SELECT id, finished_at, reporting_period_id
      FROM calculation_runs
      WHERE organization_id = ${orgId} AND status = 'succeeded'
      ORDER BY created_at DESC
      LIMIT 1
    )
    SELECT
      r.id AS "runId",
      r.finished_at AS "finishedAt",
      r.reporting_period_id AS "reportingPeriodId",
      s.n AS "calculationCount",
      s.zero AS "zeroCo2eCount",
      s.nofactor AS "noFactorCount",
      s.total AS "totalCo2e",
      s.approved AS "approvedCo2e",
      s.fallback AS "fallbackCo2e",
      CASE WHEN r.finished_at IS NULL THEN 0 ELSE (
        SELECT count(*) FROM activity_records
        WHERE organization_id = ${orgId}
          AND reporting_period_id = r.reporting_period_id
          AND created_at > r.finished_at
      ) END::int AS "recordsAddedSince"
    FROM r
    CROSS JOIN LATERAL (
      SELECT
        count(*)::int AS n,
        (count(*) FILTER (WHERE ec.total_co2e = 0))::int AS zero,
        (count(*) FILTER (WHERE ec.total_co2e = 0 AND ec.emission_factor_id IS NULL AND ec.organization_emission_factor_id IS NULL))::int AS nofactor,
        sum(ec.total_co2e)::text AS total,
        (sum(ec.total_co2e) FILTER (WHERE ar.review_status = 'approved'))::text AS approved,
        (sum(ec.total_co2e) FILTER (WHERE ec.selection_reason ILIKE '%fallback%'))::text AS fallback
      FROM emission_calculations ec
      LEFT JOIN activity_records ar ON ar.id = ec.activity_record_id
      WHERE ec.organization_id = ${orgId} AND ec.calculation_run_id = r.id
    ) s
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    totalCo2e: Number(row.totalCo2e ?? 0),
    approvedCo2e: Number(row.approvedCo2e ?? 0),
    fallbackCo2e: Number(row.fallbackCo2e ?? 0),
  };
}

export type PublishedLibraryRow = {
  reportingPeriodId: string;
  version: number;
  reportingPeriod: { label: string };
  calculationRun: {
    factorLibrary: { id: string; name: string; version: string };
    methodologyVersion: { name: string };
  };
};

/**
 * Every published snapshot with the factor library and methodology its run
 * used, ordered by period then newest version first.
 */
export async function loadPublishedLibraries(orgId: string): Promise<PublishedLibraryRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      reportingPeriodId: string;
      version: number;
      periodLabel: string;
      libraryId: string;
      libraryName: string;
      libraryVersion: string;
      methodologyName: string;
    }>
  >`
    SELECT
      ps.reporting_period_id AS "reportingPeriodId",
      ps.version AS "version",
      rp.label AS "periodLabel",
      fl.id AS "libraryId",
      fl.name AS "libraryName",
      fl.version AS "libraryVersion",
      mv.name AS "methodologyName"
    FROM published_snapshots ps
    JOIN reporting_periods rp ON rp.id = ps.reporting_period_id
    JOIN calculation_runs cr ON cr.id = ps.calculation_run_id
    JOIN factor_libraries fl ON fl.id = cr.factor_library_id
    JOIN methodology_versions mv ON mv.id = cr.methodology_version_id
    WHERE ps.organization_id = ${orgId}
    ORDER BY ps.reporting_period_id ASC, ps.version DESC
  `;
  return rows.map((r) => ({
    reportingPeriodId: r.reportingPeriodId,
    version: r.version,
    reportingPeriod: { label: r.periodLabel },
    calculationRun: {
      factorLibrary: { id: r.libraryId, name: r.libraryName, version: r.libraryVersion },
      methodologyVersion: { name: r.methodologyName },
    },
  }));
}
