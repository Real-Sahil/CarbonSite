{{
  config(
    materialized='table',
    indexes=[
      {'columns': ['organization_id', 'emission_date']},
      {'columns': ['facility_id', 'emission_date']}
    ]
  )
}}

-- Aggregated emissions by day
-- Pre-calculated daily totals for dashboard performance

with emissions as (
  select * from {{ ref('fct_emissions') }}
),

daily_agg as (
  select
    organization_id,
    date_trunc('day', activity_date)::date as emission_date,
    facility_id,
    emission_category_id,
    scope,
    count(*) as record_count,
    sum(total_co2e_tonnes) as total_co2e_tonnes,
    sum(co2e_kg) as total_co2e_kg,
    sum(ch4_kg_co2e) as total_ch4_co2e_kg,
    sum(n2o_kg_co2e) as total_n2o_co2e_kg,
    min(activity_date) as earliest_activity,
    max(activity_date) as latest_activity
  from emissions
  group by
    organization_id,
    date_trunc('day', activity_date),
    facility_id,
    emission_category_id,
    scope
)

select
  {{ generate_surrogate_key(['organization_id', 'emission_date', 'facility_id']) }} as daily_agg_id,
  *,
  now() as dbt_loaded_at
from daily_agg
