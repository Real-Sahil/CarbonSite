-- Staging layer for emission factors
-- Provides standardized access to emission factor library data

select
  id,
  emission_category_id,
  country_region,
  year,
  emission_factor::numeric as emission_factor,
  gwp_factor_ch4::numeric as gwp_factor_ch4,
  gwp_factor_n2o::numeric as gwp_factor_n2o,
  factor_source,
  methodology_version,
  effective_date::date as effective_date,
  sunset_date::date as sunset_date,
  created_at,
  updated_at,
  now() as dbt_loaded_at
from {{ source('carbon_site', 'emission_factor_library') }}
where deleted_at is null
  and current_date >= effective_date
  and (sunset_date is null or current_date < sunset_date)
