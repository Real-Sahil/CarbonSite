-- Staging layer for calculation runs
-- Denormalizes calculation metadata for audit and lineage tracking

with calculation_runs as (
  select
    id,
    organization_id,
    reporting_period_id,
    methodology_version_name,
    factor_library_version,
    created_at,
    started_at,
    completed_at,
    status
  from {{ source('carbon_site', 'calculation_runs') }}
)

select
  id,
  organization_id,
  reporting_period_id,
  methodology_version_name,
  factor_library_version,
  created_at,
  started_at,
  completed_at,
  status,
  case
    when status = 'succeeded' then date(completed_at)
    else null
  end as calculation_date,
  extract(epoch from (completed_at - started_at))::int as duration_seconds,
  now() as dbt_loaded_at
from calculation_runs
where status is not null
