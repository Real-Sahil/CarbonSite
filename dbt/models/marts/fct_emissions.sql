{{ config(
  materialized='table',
  tags=['marts', 'emissions'],
  indexes=[
    {'columns': ['organization_id', 'reporting_period_id']},
    {'columns': ['facility_id']},
    {'columns': ['calculation_run_id']}
  ]
) }}

WITH activity_records AS (
  SELECT * FROM {{ ref('stg_activity_records') }}
),

factors AS (
  SELECT * FROM {{ ref('stg_emission_factors') }}
),

joined AS (
  SELECT
    {{ dbt_utils.generate_surrogate_key(['a.activity_record_id', 'a.organization_id']) }} as emission_id,
    a.activity_record_id,
    a.organization_id,
    a.reporting_period_id,
    a.facility_id,
    a.emission_category_id,
    a.activity_date,
    a.original_amount,
    a.original_unit,
    a.source_description,
    f.factor_id,
    f.emission_factor,
    f.gwp_factor_ch4,
    f.gwp_factor_n2o,
    f.unit as factor_unit,
    f.source as factor_source,
    f.factor_library_version,
    f.methodology_version_name,

    -- Calculate emissions with GWP factors
    (a.original_amount * f.emission_factor) as co2_kg,
    (a.original_amount * f.emission_factor * f.gwp_factor_ch4) as ch4_kg_co2e,
    (a.original_amount * f.emission_factor * f.gwp_factor_n2o) as n2o_kg_co2e,
    (a.original_amount * f.emission_factor * (1 + f.gwp_factor_ch4 + f.gwp_factor_n2o)) as total_co2e_kg,

    a.biogenic_co2e,
    a.review_status,
    a.created_at,
    NOW() as dbt_loaded_at
  FROM activity_records a
  LEFT JOIN factors f
    ON a.emission_category_id = f.emission_category_id
    AND a.activity_date >= f.effective_date
    AND (f.sunset_date IS NULL OR a.activity_date <= f.sunset_date)
)

SELECT
  * EXCEPT (dbt_loaded_at),
  dbt_loaded_at
FROM joined
WHERE total_co2e_kg IS NOT NULL
  AND review_status = 'approved'
