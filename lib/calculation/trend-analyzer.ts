import { prisma } from '@/lib/db';

interface SupplierTrend {
  supplierId: string;
  month: Date;
  monthlyCo2e: number;
  rollingAvg3m: number;
  prevMonthCo2e: number | null;
  monthOverMonthChange: number | null;
}

interface FacilityVolatility {
  facilityId: string;
  month: Date;
  volatility12m: number;
  p95Co2e: number;
}

interface Scope3Growth {
  supplierId: string;
  quarter: Date;
  year: number;
  totalSpendGbp: number;
  sameQuarterLastYear: number | null;
  yoyGrowth: number | null;
}

/**
 * Get supplier emissions trends with moving averages and YoY comparisons
 */
export async function getSupplierTrends(
  organizationId: string,
  supplierId: string,
  monthsBack: number = 24
): Promise<SupplierTrend[]> {
  return prisma.$queryRaw<SupplierTrend[]>`
    WITH supplier_monthly AS (
      SELECT
        ${supplierId}::text as supplier_id,
        DATE_TRUNC('month', ar.activity_date)::date as month,
        SUM(ec.total_co2e_kg) / 1000 as monthly_co2e,
        COUNT(*) as record_count
      FROM activity_records ar
      JOIN emission_calculations ec ON ar.id = ec.activity_record_id
      WHERE ar.organization_id = ${organizationId}
        AND ar.supplier_id = ${supplierId}
        AND ar.activity_date >= NOW() - make_interval(months => ${monthsBack})
      GROUP BY DATE_TRUNC('month', ar.activity_date)
    )
    SELECT
      supplier_id,
      month,
      monthly_co2e,
      ROUND(
        AVG(monthly_co2e) OVER (
          ORDER BY month
          ROWS BETWEEN 3 PRECEDING AND CURRENT ROW
        )::numeric,
        2
      ) as rolling_avg_3m,
      LAG(monthly_co2e) OVER (ORDER BY month) as prev_month_co2e,
      ROUND(
        (
          (monthly_co2e - LAG(monthly_co2e) OVER (ORDER BY month)) /
          LAG(monthly_co2e) OVER (ORDER BY month)
        )::numeric,
        4
      ) as month_over_month_change
    FROM supplier_monthly
    ORDER BY month DESC;
  `;
}

/**
 * Get facility emissions volatility (standard deviation over 12-month window)
 */
export async function getFacilityVolatility(
  organizationId: string,
  facilityId: string
): Promise<FacilityVolatility[]> {
  return prisma.$queryRaw<FacilityVolatility[]>`
    SELECT
      ${facilityId}::text as facility_id,
      DATE_TRUNC('month', ar.activity_date)::date as month,
      ROUND(
        (
          STDDEV_POP(ec.total_co2e_kg) OVER (
            ORDER BY DATE_TRUNC('month', ar.activity_date)
            ROWS BETWEEN 11 PRECEDING AND CURRENT ROW
          )
        )::numeric,
        2
      ) as volatility_12m,
      ROUND(
        (
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ec.total_co2e_kg)
          OVER ()
        )::numeric,
        2
      ) as p95_co2e
    FROM activity_records ar
    JOIN emission_calculations ec ON ar.id = ec.activity_record_id
    WHERE ar.organization_id = ${organizationId}
      AND ar.facility_id = ${facilityId}
    ORDER BY month DESC;
  `;
}

/**
 * Get Scope 3 spend-based trends with YoY comparison
 */
export async function getScope3Growth(
  organizationId: string,
  supplierId: string
): Promise<Scope3Growth[]> {
  return prisma.$queryRaw<Scope3Growth[]>`
    SELECT
      ${supplierId}::text as supplier_id,
      DATE_TRUNC('quarter', ar.activity_date)::date as quarter,
      EXTRACT(YEAR FROM ar.activity_date)::int as year,
      ROUND(SUM(CAST(ar.normalized_amount AS numeric)), 2) as total_spend_gbp,
      ROUND(
        LAG(SUM(CAST(ar.normalized_amount AS numeric))) OVER (
          PARTITION BY EXTRACT(QUARTER FROM ar.activity_date)
          ORDER BY EXTRACT(YEAR FROM ar.activity_date)
        )::numeric,
        2
      ) as same_quarter_last_year,
      ROUND(
        (
          (SUM(CAST(ar.normalized_amount AS numeric)) -
           LAG(SUM(CAST(ar.normalized_amount AS numeric))) OVER (
             PARTITION BY EXTRACT(QUARTER FROM ar.activity_date)
             ORDER BY EXTRACT(YEAR FROM ar.activity_date)
           )) /
          LAG(SUM(CAST(ar.normalized_amount AS numeric))) OVER (
            PARTITION BY EXTRACT(QUARTER FROM ar.activity_date)
            ORDER BY EXTRACT(YEAR FROM ar.activity_date)
          )
        )::numeric,
        4
      ) as yoy_growth
    FROM activity_records ar
    WHERE ar.organization_id = ${organizationId}
      AND ar.supplier_id = ${supplierId}
      AND ar.emission_category_id LIKE 's3-%'
    GROUP BY
      DATE_TRUNC('quarter', ar.activity_date),
      EXTRACT(YEAR FROM ar.activity_date)
    ORDER BY year DESC, quarter DESC;
  `;
}

/**
 * Get organization-wide emissions trend (all facilities, all scopes)
 */
export async function getOrgEmissionsTrend(
  organizationId: string,
  monthsBack: number = 24
): Promise<Array<{ month: Date; totalCo2e: number; scope1: number; scope2: number; scope3: number }>> {
  return prisma.$queryRaw<
    Array<{ month: Date; totalCo2e: number; scope1: number; scope2: number; scope3: number }>
  >`
    WITH monthly_emissions AS (
      SELECT
        DATE_TRUNC('month', ar.activity_date)::date as month,
        CASE
          WHEN ec.emission_category_id LIKE 's1-%' THEN 'scope1'
          WHEN ec.emission_category_id LIKE 's2-%' THEN 'scope2'
          WHEN ec.emission_category_id LIKE 's3-%' THEN 'scope3'
          ELSE 'other'
        END as scope,
        SUM(ec.total_co2e_kg) / 1000 as co2e
      FROM activity_records ar
      JOIN emission_calculations ec ON ar.id = ec.activity_record_id
      WHERE ar.organization_id = ${organizationId}
        AND ar.activity_date >= NOW() - make_interval(months => ${monthsBack})
      GROUP BY
        DATE_TRUNC('month', ar.activity_date),
        CASE
          WHEN ec.emission_category_id LIKE 's1-%' THEN 'scope1'
          WHEN ec.emission_category_id LIKE 's2-%' THEN 'scope2'
          WHEN ec.emission_category_id LIKE 's3-%' THEN 'scope3'
          ELSE 'other'
        END
    )
    SELECT
      month,
      SUM(co2e) as total_co2e,
      COALESCE(SUM(CASE WHEN scope = 'scope1' THEN co2e ELSE 0 END), 0) as scope1,
      COALESCE(SUM(CASE WHEN scope = 'scope2' THEN co2e ELSE 0 END), 0) as scope2,
      COALESCE(SUM(CASE WHEN scope = 'scope3' THEN co2e ELSE 0 END), 0) as scope3
    FROM monthly_emissions
    GROUP BY month
    ORDER BY month DESC;
  `;
}

/**
 * Get top N suppliers by recent emissions (for dashboard insights)
 */
export async function getTopSuppliersByEmissions(
  organizationId: string,
  limit: number = 10,
  monthsBack: number = 12
): Promise<
  Array<{
    supplierId: string;
    supplierName: string;
    totalCo2e: number;
    submissionCount: number;
    trend: string;
  }>
> {
  return prisma.$queryRaw<
    Array<{
      supplierId: string;
      supplierName: string;
      totalCo2e: number;
      submissionCount: number;
      trend: string;
    }>
  >`
    SELECT
      ar.supplier_id as supplier_id,
      'Supplier ' || ar.supplier_id as supplier_name,
      ROUND(SUM(ec.total_co2e_kg) / 1000, 2) as total_co2e,
      COUNT(*) as submission_count,
      CASE
        WHEN AVG(ec.total_co2e_kg) > LAG(AVG(ec.total_co2e_kg)) OVER (PARTITION BY ar.supplier_id ORDER BY DATE_TRUNC('month', ar.activity_date)) * 1.1
        THEN 'increasing'
        WHEN AVG(ec.total_co2e_kg) < LAG(AVG(ec.total_co2e_kg)) OVER (PARTITION BY ar.supplier_id ORDER BY DATE_TRUNC('month', ar.activity_date)) * 0.9
        THEN 'decreasing'
        ELSE 'stable'
      END as trend
    FROM activity_records ar
    JOIN emission_calculations ec ON ar.id = ec.activity_record_id
    WHERE ar.organization_id = ${organizationId}
      AND ar.activity_date >= NOW() - make_interval(months => ${monthsBack})
      AND ar.supplier_id IS NOT NULL
    GROUP BY ar.supplier_id
    ORDER BY total_co2e DESC
    LIMIT ${limit};
  `;
}

/**
 * Detect anomalies in facility emissions (z-score based)
 */
export async function detectFacilityAnomalies(
  organizationId: string,
  facilityId: string,
  stddevThreshold: number = 3
): Promise<
  Array<{
    activityRecordId: string;
    date: Date;
    value: number;
    expectedValue: number;
    severity: string;
  }>
> {
  return prisma.$queryRaw<
    Array<{
      activityRecordId: string;
      date: Date;
      value: number;
      expectedValue: number;
      severity: string;
    }>
  >`
    WITH facility_stats AS (
      SELECT
        ar.facility_id,
        AVG(ec.total_co2e_kg) as mean_value,
        STDDEV_POP(ec.total_co2e_kg) as stddev_value
      FROM activity_records ar
      JOIN emission_calculations ec ON ar.id = ec.activity_record_id
      WHERE ar.organization_id = ${organizationId}
        AND ar.facility_id = ${facilityId}
      GROUP BY ar.facility_id
    ),
    anomaly_detection AS (
      SELECT
        ar.id as activity_record_id,
        ar.activity_date as date,
        ec.total_co2e_kg as value,
        fs.mean_value as expected_value,
        ABS((ec.total_co2e_kg - fs.mean_value) / NULLIF(fs.stddev_value, 0)) as z_score
      FROM activity_records ar
      JOIN emission_calculations ec ON ar.id = ec.activity_record_id
      JOIN facility_stats fs ON ar.facility_id = fs.facility_id
      WHERE ar.organization_id = ${organizationId}
        AND ar.facility_id = ${facilityId}
    )
    SELECT
      activity_record_id,
      date,
      ROUND(value::numeric, 2),
      ROUND(expected_value::numeric, 2),
      CASE
        WHEN z_score > ${stddevThreshold} THEN 'critical'
        WHEN z_score > ${stddevThreshold - 1} THEN 'high'
        WHEN z_score > 2 THEN 'medium'
        ELSE 'low'
      END as severity
    FROM anomaly_detection
    WHERE z_score > 2
    ORDER BY z_score DESC;
  `;
}
