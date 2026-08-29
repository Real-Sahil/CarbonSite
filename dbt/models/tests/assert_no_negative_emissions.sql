-- Test: total_co2e_kg should never be negative
-- Negative values indicate calculation errors or bad data

SELECT
  emission_calculation_id,
  total_co2e_kg,
  calculation_formula
FROM {{ ref('fct_emissions') }}
WHERE total_co2e_kg < 0
