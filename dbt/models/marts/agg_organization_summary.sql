{{
  config(
    materialized='table',
    indexes=[
      {'columns': ['organization_id']},
      {'columns': ['reporting_period_id']}
    ]
  )
}}

-- Organization-level summary aggregation
-- Powers dashboard totals and reporting without querying raw emission records

with emissions as (
  select
    organization_id,
    reporting_period_id,
    scope,
    total_co2e_tonnes
  from {{ ref('fct_emissions') }}
  where total_co2e_tonnes is not null
),

scope_totals as (
  select
    organization_id,
    reporting_period_id,
    scope,
    count(*) as record_count,
    sum(total_co2e_tonnes) as total_co2e_tonnes,
    avg(total_co2e_tonnes) as avg_co2e_tonnes,
    min(total_co2e_tonnes) as min_co2e_tonnes,
    max(total_co2e_tonnes) as max_co2e_tonnes
  from emissions
  group by organization_id, reporting_period_id, scope
),

combined_scopes as (
  select
    organization_id,
    reporting_period_id,
    'Total' as scope,
    sum(record_count) as record_count,
    sum(total_co2e_tonnes) as total_co2e_tonnes,
    avg(avg_co2e_tonnes) as avg_co2e_tonnes,
    min(min_co2e_tonnes) as min_co2e_tonnes,
    max(max_co2e_tonnes) as max_co2e_tonnes
  from scope_totals
  group by organization_id, reporting_period_id

  union all

  select * from scope_totals
),

final as (
  select
    {{ generate_surrogate_key(['organization_id', 'reporting_period_id', 'scope']) }} as summary_id,
    *,
    now() as dbt_loaded_at
  from combined_scopes
)

select * from final
