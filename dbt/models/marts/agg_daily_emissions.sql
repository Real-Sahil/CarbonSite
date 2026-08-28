{{ config(
  materialized='table',
  tags=['marts', 'aggregates'],
  indexes=[
    {'columns': ['organization_id', 'date']},
    {'columns': ['facility_id', 'date']},
    {'columns': ['emission_category_id', 'date']}
  ]
) }}

SELECT
  {{ dbt_utils.generate_surrogate_key(['organization_id', 'date', 'facility_id']) }} as aggregate_id,
  organization_id,
  date,
  facility_id,
  emission_category_id,

  -- Metrics
  COUNT(DISTINCT activity_record_id) as record_count,
  SUM(total_co2e_kg) as total_co2e_kg,
  SUM(co2_kg) as co2_kg,
  SUM(ch4_kg_co2e) as ch4_kg_co2e,
  SUM(n2o_kg_co2e) as n2o_kg_co2e,
  SUM(biogenic_co2e) as biogenic_co2e_kg,
  AVG(total_co2e_kg) as avg_co2e_per_record_kg,

  -- Quality tracking
  COUNT(DISTINCT factor_id) as factor_variants_used,
  COUNT(DISTINCT factor_library_version) as library_versions,

  NOW() as dbt_loaded_at
FROM {{ ref('fct_emissions') }}
GROUP BY
  organization_id,
  date,
  facility_id,
  emission_category_id
