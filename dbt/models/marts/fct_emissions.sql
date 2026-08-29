-- Fact table: all calculated emissions with full context
-- Immutable denormalization of EmissionCalculation + context tables
-- Purpose: analytics, dashboards, audit evidence
-- Updated after each calculation run

{{ config(
  materialized = 'table',
  indexes = [
    {'columns': ['organization_id', 'reporting_period_id']},
    {'columns': ['facility_id']},
    {'columns': ['calculation_run_id']},
    {'columns': ['emission_scope']}
  ]
) }}

WITH activity_with_staging AS (
  SELECT * FROM {{ ref('stg_activity_records') }}
),

factors_with_staging AS (
  SELECT * FROM {{ ref('stg_emission_factors') }}
),

calculations_with_staging AS (
  SELECT * FROM {{ ref('stg_calculations') }}
),

joined AS (
  SELECT
    ec.id as emission_calculation_id,
    ec.organization_id,
    ec.activity_record_id,
    ec.calculation_run_id,
    ec.emission_factor_id,
    ar.facility_id,
    ar.emission_category_id,
    ar.category_code,
    ar.emission_scope,
    ar.activity_type,
    ar.reporting_period_id,
    ar.period_start_date,
    ar.period_end_date,
    ar.original_amount,
    ar.original_unit,
    ar.activity_date,
    ar.country,
    cr.factor_library_name,
    cr.factor_library_version,
    cr.methodology_version_name,
    ef.input_unit as factor_input_unit,
    ef.co2_kg_per_unit,
    ef.ch4_kg_per_unit,
    ef.n2o_kg_per_unit,
    ef.co2e_kg_per_unit,
    ec.normalized_amount,
    ec.normalized_unit,
    ec.total_co2e as total_co2e_kg,
    (ec.total_co2e / 1000.0)::decimal(15, 6) as total_co2e_tonnes,
    ec.co2_kg,
    ec.ch4_kg,
    ec.n2o_kg,
    ec.formula as calculation_formula,
    ec.warnings,
    ec.data_quality_score,
    ec.confidence_interval_lower,
    ec.confidence_interval_upper,
    ec.factor_library_version as calculation_factor_library_version,
    ec.methodology_version_name as calculation_methodology_version,
    cr.run_status,
    cr.factor_library_name as run_factor_library_name,
    COALESCE(cr.published_snapshot_id, 'unpublished') as snapshot_status,
    cr.run_created_at,
    cr.run_updated_at,
    ec.created_at as calculation_created_at
  FROM emission_calculations ec
  LEFT JOIN activity_with_staging ar ON ec.activity_record_id = ar.activity_record_id
  LEFT JOIN calculations_with_staging cr ON ec.calculation_run_id = cr.calculation_run_id
  LEFT JOIN factors_with_staging ef ON ec.emission_factor_id = ef.factor_id
  WHERE ec.deleted_at IS NULL
)

SELECT
  emission_calculation_id,
  organization_id,
  activity_record_id,
  calculation_run_id,
  emission_factor_id,
  facility_id,
  emission_category_id,
  category_code,
  emission_scope,
  activity_type,
  reporting_period_id,
  period_start_date,
  period_end_date,
  original_amount,
  original_unit,
  activity_date,
  country,
  factor_library_name,
  factor_library_version,
  methodology_version_name,
  factor_input_unit,
  co2_kg_per_unit,
  ch4_kg_per_unit,
  n2o_kg_per_unit,
  co2e_kg_per_unit,
  normalized_amount,
  normalized_unit,
  total_co2e_kg,
  total_co2e_tonnes,
  co2_kg,
  ch4_kg,
  n2o_kg,
  calculation_formula,
  warnings,
  data_quality_score,
  confidence_interval_lower,
  confidence_interval_upper,
  calculation_factor_library_version,
  calculation_methodology_version,
  run_status,
  run_factor_library_name,
  snapshot_status,
  run_created_at,
  run_updated_at,
  calculation_created_at,
  CURRENT_TIMESTAMP as dbt_loaded_at
FROM joined
ORDER BY organization_id, reporting_period_id, activity_date
