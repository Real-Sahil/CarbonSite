-- Test: emission_calculation_id should be unique
-- Ensures no duplicate calculations are created

SELECT
  emission_calculation_id
FROM {{ ref('fct_emissions') }}
GROUP BY emission_calculation_id
HAVING COUNT(*) > 1
