-- Aggregate table: daily emissions totals by org, facility, category
-- Pre-computed for fast dashboard queries
-- Rebuilt after each calculation run

{{ config(
  materialized = 'table',
  indexes = [
    {'columns': ['organization_id', 'activity_date']},
    {'columns': ['facility_id', 'activity_date']},
    {'columns': ['emission_scope']}
  ]
) }}

SELECT
  organization_id,
  activity_date,
  facility_id,
  emission_scope,
  category_code,
  COUNT(*) as record_count,
  SUM(total_co2e_kg) as total_co2e_kg,
  SUM(total_co2e_tonnes) as total_co2e_tonnes,
  AVG(data_quality_score) as avg_quality_score,
  MIN(confidence_interval_lower) as min_confidence_lower,
  MAX(confidence_interval_upper) as max_confidence_upper,
  STRING_AGG(DISTINCT warnings::text, '; ') FILTER (WHERE warnings IS NOT NULL) as aggregated_warnings,
  MAX(calculation_created_at) as last_calculation_at
FROM {{ ref('fct_emissions') }}
WHERE run_status = 'complete' 
  OR run_status IS NULL
GROUP BY 
  organization_id,
  activity_date,
  facility_id,
  emission_scope,
  category_code
ORDER BY organization_id, activity_date DESC
