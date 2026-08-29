-- Test to ensure no negative emissions values in fact table
-- Negative emissions are impossible and indicate data quality issues

select *
from {{ ref('fct_emissions') }}
where total_co2e_kg < 0
  or co2e_kg < 0
  or total_co2e_tonnes < 0
