import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { HEADLINE_ONLY } from "@/lib/project-carbon/sql";
import { summariseAccounts, type AccountCarbonInput, type CarbonByAccountView } from "./account-carbon";

type AccountRow = {
  account: string | null;
  record_count: number;
  uncalculated_record_count: number;
  co2e_kg: number;
  spend_amount: number;
  spend_co2e_kg: number;
  spend_record_count: number;
  other_currency_record_count: number;
};

/**
 * Headline carbon by ledger account for every approved record of the
 * organisation, across all periods. Each record uses its latest calculation, so
 * re-running a period never double counts, and market-based Scope 2 is left out
 * as everywhere else. Spend counts only records in the reporting currency (a
 * blank currency means reporting, as on the supplier table), and intensity uses
 * only the records that have both spend and a calculation.
 */
export async function loadCarbonByAccount(orgId: string, reportingCurrency: string): Promise<CarbonByAccountView> {
  const reporting = reportingCurrency.trim().toUpperCase();
  const inReporting = Prisma.sql`(ar.spend_amount > 0 AND COALESCE(UPPER(BTRIM(ar.spend_currency)), '') IN ('', ${reporting}))`;

  const rows = await prisma.$queryRaw<AccountRow[]>`
    SELECT
      NULLIF(BTRIM(ar.ledger_account), '') AS account,
      COUNT(*)::int AS record_count,
      COUNT(*) FILTER (WHERE ec.total_co2e IS NULL)::int AS uncalculated_record_count,
      COALESCE(SUM(ec.total_co2e), 0)::float AS co2e_kg,
      COALESCE(SUM(ar.spend_amount) FILTER (WHERE ${inReporting} AND ec.total_co2e IS NOT NULL), 0)::float AS spend_amount,
      COALESCE(SUM(ec.total_co2e) FILTER (WHERE ${inReporting} AND ec.total_co2e IS NOT NULL), 0)::float AS spend_co2e_kg,
      COUNT(*) FILTER (WHERE ${inReporting} AND ec.total_co2e IS NOT NULL)::int AS spend_record_count,
      COUNT(*) FILTER (WHERE ar.spend_amount > 0 AND NOT ${inReporting})::int AS other_currency_record_count
    FROM activity_records ar
    JOIN emission_categories cat ON cat.id = ar.emission_category_id
    LEFT JOIN LATERAL (
      SELECT total_co2e FROM emission_calculations
      WHERE activity_record_id = ar.id
      ORDER BY created_at DESC LIMIT 1
    ) ec ON TRUE
    WHERE ar.organization_id = ${orgId}
      AND ar.review_status = 'approved'
      AND ${HEADLINE_ONLY}
    GROUP BY NULLIF(BTRIM(ar.ledger_account), '')
  `;

  const inputs: AccountCarbonInput[] = rows.map((r) => ({
    account: r.account,
    recordCount: r.record_count,
    uncalculatedRecordCount: r.uncalculated_record_count,
    co2eKg: r.co2e_kg,
    spendAmount: r.spend_amount,
    spendCo2eKg: r.spend_co2e_kg,
    spendRecordCount: r.spend_record_count,
    otherCurrencyRecordCount: r.other_currency_record_count,
  }));
  return summariseAccounts(inputs);
}
