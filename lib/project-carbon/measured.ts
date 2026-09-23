import { prisma } from "@/lib/db";
import { HEADLINE_ONLY } from "./sql";

/**
 * A project's measured carbon to date, tCO2e: its embodied carbon records
 * plus approved activity on its sites, using each record's latest
 * calculation so re-running a period never double counts, and leaving out
 * market-based Scope 2 (reported beside location-based, never added).
 */
export async function measuredProjectTco2e(orgId: string, projectId: string): Promise<{ embodied: number; activity: number; total: number }> {
  const [embodiedAgg, activityRows] = await Promise.all([
    prisma.embodiedCarbonRecord.aggregate({
      where: { organizationId: orgId, projectId },
      _sum: { totalKgCo2e: true },
    }),
    prisma.$queryRaw<Array<{ total_co2e: number }>>`
      SELECT COALESCE(SUM(ec.total_co2e), 0)::float AS total_co2e
      FROM activity_records ar
      JOIN sites s ON s.id = ar.site_id
      JOIN emission_categories cat ON cat.id = ar.emission_category_id
      LEFT JOIN LATERAL (
        SELECT total_co2e FROM emission_calculations
        WHERE activity_record_id = ar.id
        ORDER BY created_at DESC LIMIT 1
      ) ec ON TRUE
      WHERE s.project_id = ${projectId}
        AND s.organization_id = ${orgId}
        AND ar.organization_id = ${orgId}
        AND ar.review_status = 'approved'
        AND ${HEADLINE_ONLY}
    `,
  ]);
  const embodied = (embodiedAgg._sum.totalKgCo2e ?? 0) / 1000;
  const activity = Number(activityRows[0]?.total_co2e ?? 0) / 1000;
  return { embodied, activity, total: embodied + activity };
}
