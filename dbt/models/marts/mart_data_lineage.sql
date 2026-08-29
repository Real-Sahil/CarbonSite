{{
  config(
    materialized='view',
    tags: ['lineage']
  )
}}

-- Data lineage view for audit and compliance
-- Traces the complete path from source records to published reports

with activity_base as (
  select
    'activity_record' as source_type,
    a.id as source_id,
    a.organization_id,
    a.activity_date,
    a.source_description,
    'raw_import' as stage
  from {{ source('carbon_site', 'activity_records') }} a
),

with_factors as (
  select
    e.activity_record_id,
    e.emission_id,
    e.organization_id,
    e.activity_date,
    'emission_calculation' as stage,
    e.factor_source,
    e.methodology_version,
    e.total_co2e_tonnes
  from {{ ref('fct_emissions') }} e
),

with_snapshot as (
  select
    e.activity_record_id,
    e.emission_id,
    s.snapshot_id,
    s.organization_id,
    s.reporting_period_id,
    'published_snapshot' as stage,
    s.snapshot_date,
    e.total_co2e_tonnes
  from {{ ref('fct_emissions') }} e
  left join {{ source('carbon_site', 'published_snapshots') }} s
    on e.organization_id = s.organization_id
    and e.activity_date >= s.snapshot_date - interval '30 days'
    and e.activity_date <= s.snapshot_date
)

select
  activity_record_id,
  organization_id,
  'activity_record → calculation → snapshot' as lineage_path,
  stage,
  total_co2e_tonnes,
  now() as recorded_at
from with_snapshot
where activity_record_id is not null
