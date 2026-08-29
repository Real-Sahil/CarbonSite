-- Test: if calculation has an emission_factor_id, it should reference a real factor
-- Catch orphaned factor references

SELECT
  ec.emission_calculation_id,
  ec.emission_factor_id
FROM {{ ref('fct_emissions') }} ec
WHERE ec.emission_factor_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM emission_factors ef 
    WHERE ef.id = ec.emission_factor_id
  )
