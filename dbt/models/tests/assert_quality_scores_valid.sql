-- Test: data_quality_score should be between 0 and 100
-- Out-of-range scores indicate calculation errors

SELECT
  emission_calculation_id,
  data_quality_score
FROM {{ ref('fct_emissions') }}
WHERE data_quality_score < 0 OR data_quality_score > 100
