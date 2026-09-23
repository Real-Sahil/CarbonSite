-- DESNZ published no 2025 closed-loop recycling value for commercial and
-- industrial waste, so 20260923000006 left these two factors out of DEFRA
-- 2025.2. DESNZ applies one recycling figure (transport to the recycling
-- facility) to every material in a year, and gives this row that figure in
-- 2026, so the published 2025 mixed paper and board closed-loop row stands in.
-- Values from prisma/data/defra-2025-factors.json (scripts/build-defra-factors.mjs).
-- On an empty database (CI) the library and category lookups match nothing.
WITH lib AS (
  SELECT "id" FROM "factor_libraries" WHERE "name" = 'DEFRA' AND "version" = '2025.2'
), src ("external_id", "category_code", "activity_type", "geography_country", "input_unit", "co2e", "usage_notes") AS (
  VALUES
  ('defra-2025-waste-mixed-recycling', 's3-waste', 'waste_disposal', 'GB', 'tonne', 4.68568, 'Commercial and industrial waste, closed-loop recycling. Uses the mixed paper and board closed-loop row, the single DESNZ 2025 recycling figure. DESNZ 2025 v1 flat file, row 20_506_5450_15_1.'),
  ('defra-2025-waste-recycled-mixed-kg', 's3-waste', 'waste_disposal', 'GB', 'kg', 0.00468568, 'Commercial and industrial waste, closed-loop recycling, per kg. Uses the mixed paper and board closed-loop row, the single DESNZ 2025 recycling figure. DESNZ 2025 v1 flat file, row 20_506_5450_15_1, per tonne / 1000.')
)
INSERT INTO "emission_factors" (
  "id", "factor_library_id", "external_id", "scope", "emission_category_id", "activity_type",
  "geography_country", "input_unit", "co2e", "usage_notes"
)
SELECT gen_random_uuid()::text, lib."id", src."external_id", c."scope", c."id", src."activity_type",
       src."geography_country", src."input_unit", src."co2e", src."usage_notes"
FROM src
JOIN "emission_categories" c ON c."code" = src."category_code"
CROSS JOIN lib
WHERE NOT EXISTS (
  SELECT 1 FROM "emission_factors" e WHERE e."factor_library_id" = lib."id" AND e."external_id" = src."external_id"
);
