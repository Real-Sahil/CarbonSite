-- DESNZ/DEFRA "Heat and steam" (Scope 2) factors for the DEFRA 2025.2 and
-- 2026.1 libraries, in the s2-heat category added by 20260924000026. Values
-- read from the published flat files (both years publish 0.17529 kg CO2e per
-- kWh delivered):
--   2025 v1:   ghg-conversion-factors-2025-flat-format.xlsx
--              (sha256 8bfdb45b81ec4a88e3bdf4584637330f62e6bd09ce1940e654c5d7b7f736de94)
--   2026 v1.2: ghg-conversion-factors-2026-flat-format-revised.xlsx
--              (sha256 a9a455ab396dae226d510c7be6233748416d490c41a5d20f3dc7a0c45feecd5e)
-- Rows 10_401_4003_5_1 (district) and 10_401_4002_5_1 (onsite). Mirrors the
-- heat-* entries in scripts/build-defra-factors.mjs and prisma/data. Additive;
-- on an empty database the category lookup matches nothing.

INSERT INTO "emission_categories" ("id", "scope", "code", "name", "activity_type")
VALUES (gen_random_uuid()::text, 2, 's2-heat', 'Purchased Heat, Steam & Cooling', 'purchased_heat')
ON CONFLICT ("code") DO NOTHING;

WITH src ("version", "external_id", "activity_type", "co2e", "usage_notes") AS (
  VALUES
    ('2025.2', 'defra-2025-heat-district-kwh', 'purchased_heat', 0.17529::numeric, 'District heat and steam, per kWh delivered. DESNZ 2025 v1 flat file, row 10_401_4003_5_1.'),
    ('2025.2', 'defra-2025-heat-onsite-kwh', 'purchased_heat_onsite', 0.17529::numeric, 'Onsite heat and steam bought from a third-party plant, per kWh delivered. DESNZ 2025 v1 flat file, row 10_401_4002_5_1.'),
    ('2026.1', 'defra-2026-heat-district-kwh', 'purchased_heat', 0.17529::numeric, 'District heat and steam, per kWh delivered. DESNZ 2026 v1.2 flat file, row 10_401_4003_5_1.'),
    ('2026.1', 'defra-2026-heat-onsite-kwh', 'purchased_heat_onsite', 0.17529::numeric, 'Onsite heat and steam bought from a third-party plant, per kWh delivered. DESNZ 2026 v1.2 flat file, row 10_401_4002_5_1.')
)
INSERT INTO "emission_factors" (
  "id", "factor_library_id", "external_id", "scope", "emission_category_id", "activity_type",
  "geography_country", "input_unit", "co2e", "usage_notes"
)
SELECT gen_random_uuid()::text, l."id", src."external_id", c."scope", c."id", src."activity_type",
       'GB', 'kWh', src."co2e", src."usage_notes"
FROM src
JOIN "factor_libraries" l ON l."name" = 'DEFRA' AND l."version" = src."version"
JOIN "emission_categories" c ON c."code" = 's2-heat'
WHERE NOT EXISTS (
  SELECT 1 FROM "emission_factors" e WHERE e."factor_library_id" = l."id" AND e."external_id" = src."external_id"
);
