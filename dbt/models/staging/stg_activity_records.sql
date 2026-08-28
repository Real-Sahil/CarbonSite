-- Staging layer for activity records
-- Cleans and standardizes activity records from the source data

with activity_records as (
  select
    id,
    organization_id,
    emission_category_id,
    reporting_period_id,
    facility_id,
    business_unit_id,
    original_amount,
    original_unit,
    normalized_amount,
    normalized_unit,
    source_description,
    activity_date,
    review_status,
    created_at,
    updated_at,
    created_by_user_id
  from {{ source('carbon_site', 'activity_records') }}
  where deleted_at is null
)

select
  id,
  organization_id,
  emission_category_id,
  reporting_period_id,
  facility_id,
  business_unit_id,
  original_amount::numeric as original_amount,
  original_unit,
  normalized_amount::numeric as normalized_amount,
  normalized_unit,
  source_description,
  activity_date::date as activity_date,
  review_status,
  created_at,
  updated_at,
  created_by_user_id,
  now() as dbt_loaded_at
from activity_records
