{{ config(
  materialized='view',
  tags=['staging', 'factors']
) }}

SELECT
  id as factor_id,
  emission_category_id,
  geography_code,
  scope,
  emission_factor,
  gwp_factor_ch4,
  gwp_factor_n2o,
  unit,
  source,
  factor_library_version,
  methodology_version_name,
  effective_date,
  sunset_date,
  confidence_score,
  created_at
FROM {{ source('carbonsite', 'emission_factors') }}
WHERE sunset_date IS NULL OR sunset_date > NOW()
  AND effective_date <= NOW()
