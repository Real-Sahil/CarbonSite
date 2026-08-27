{{
  config(
    materialized='table',
    indexes=[
      {'columns': ['organization_id']},
      {'columns': ['facility_id']}
    ]
  )
}}

-- Dimension table for facilities
-- Provides facility metadata and attributes for slicing emissions data

select
  f.id as facility_id,
  f.organization_id,
  f.name as facility_name,
  f.facility_type,
  f.country,
  f.region,
  f.postcode,
  f.headcount,
  f.footprint_sqm,
  f.sector_code,
  f.latitude,
  f.longitude,
  f.created_at,
  f.updated_at,
  now() as dbt_loaded_at
from {{ source('carbon_site', 'facilities') }} f
where f.deleted_at is null
