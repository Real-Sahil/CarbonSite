{{ config(
  materialized='view',
  tags=['staging', 'emissions'],
  indexes=[
    {'columns': ['organization_id', 'reporting_period_id']},
    {'columns': ['facility_id', 'activity_date']}
  ]
) }}

SELECT
  id as activity_record_id,
  organization_id,
  reporting_period_id,
  emission_category_id,
  activity_date,
  amount as original_amount,
  unit as original_unit,
  source_description,
  facility_id,
  business_unit_id,
  supplier_name,
  country,
  region,
  spend_amount,
  spend_currency,
  distance_amount,
  distance_unit,
  pickup_postcode,
  delivery_postcode,
  transport_mode,
  fuel_type,
  refrigerant_type,
  scope2_method,
  biogenic_co2e,
  review_status,
  evidence_status,
  assumption_notes,
  import_batch_id,
  field_submission_id,
  created_by_user_id,
  created_at,
  updated_at
FROM {{ source('carbonsite', 'activity_records') }}
WHERE organization_id = '{{ var("org_id", "00000000-0000-0000-0000-000000000000") }}'
