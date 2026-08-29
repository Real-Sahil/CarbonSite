-- Staging model: cleaned activity records ready for calculation
-- Source: activity_records table
-- Enriched with category, facility, and reporting period context

SELECT
  ar.id as activity_record_id,
  ar.organization_id,
  ar.facility_id,
  ar.business_unit_id,
  ar.emission_category_id,
  ec.code as category_code,
  ec.scope as emission_scope,
  ec.activity_type,
  ar.reporting_period_id,
  rp.start_date as period_start_date,
  rp.end_date as period_end_date,
  ar.amount as original_amount,
  ar.unit as original_unit,
  ar.review_status,
  ar.activity_date,
  ar.start_date,
  ar.end_date,
  ar.description,
  ar.fuel_type,
  ar.transport_mode,
  ar.refrigerant_type,
  ar.country,
  ar.scope2_method,
  ar.import_batch_id,
  ar.created_at as record_created_at,
  ar.updated_at as record_updated_at
FROM activity_records ar
LEFT JOIN emission_categories ec ON ar.emission_category_id = ec.id
LEFT JOIN reporting_periods rp ON ar.reporting_period_id = rp.id
WHERE ar.deleted_at IS NULL
ORDER BY ar.organization_id, ar.activity_date
