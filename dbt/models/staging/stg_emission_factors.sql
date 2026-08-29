-- Staging model: emission factors with version tracking
-- Source: emission_factors table
-- Denormalizes factor library version for audit trail

SELECT
  ef.id as factor_id,
  ef.factor_library_id,
  fl.name as factor_library_name,
  fl.version as factor_library_version,
  ef.emission_category_id,
  ec.code as category_code,
  ef.activity_type,
  ef.geography_country,
  ef.scope_2_method,
  ef.fuel_type,
  ef.input_unit,
  ef.co2_kg_per_unit,
  ef.ch4_kg_per_unit,
  ef.n2o_kg_per_unit,
  ef.co2e_kg_per_unit,
  ef.source_url,
  ef.effective_date,
  ef.sunset_date,
  ef.created_at as factor_created_at,
  ef.updated_at as factor_updated_at,
  CASE 
    WHEN ef.sunset_date IS NULL THEN 'active'
    WHEN ef.sunset_date > CURRENT_DATE THEN 'active'
    ELSE 'sunset'
  END as factor_status
FROM emission_factors ef
LEFT JOIN factor_libraries fl ON ef.factor_library_id = fl.id
LEFT JOIN emission_categories ec ON ef.emission_category_id = ec.id
ORDER BY ef.effective_date DESC, ef.factor_library_id
