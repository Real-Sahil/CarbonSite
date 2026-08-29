-- Test to ensure organization scoping is maintained across all tables
-- Broken scoping is a critical security bug

select
  'activity_records' as table_name,
  count(*) as missing_org_count
from {{ source('carbon_site', 'activity_records') }}
where organization_id is null

union all

select
  'emission_categories' as table_name,
  count(*) as missing_org_count
from {{ source('carbon_site', 'emission_categories') }}
where organization_id is null

having count(*) > 0
