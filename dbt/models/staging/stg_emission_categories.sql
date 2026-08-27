-- Staging layer for emission categories
-- Provides clean, standardized emission category data

select
  id,
  code,
  name,
  scope,
  description,
  created_at,
  updated_at,
  now() as dbt_loaded_at
from {{ source('carbon_site', 'emission_categories') }}
where deleted_at is null
