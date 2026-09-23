-- DEFRA "Outside of scopes" biogenic CO2 for the biofuel and biomass factors
-- in the 2025.2 and 2026.1 libraries (identical in both releases). The memo is
-- reported beside the inventory and never added to it. Existing calculations
-- are immutable and keep what they recorded; new runs pick the memo up.
-- Source rows: 99_604_1011_8_2, 99_604_1017_8_2, 99_103_1036_8_2,
-- 99_104_1044_15_2 and 99_104_1045_15_2 (per tonne / 1000 for the per-kg rows).
UPDATE "emission_factors" f
SET "biogenic_co2" = v."biogenic_co2"
FROM (VALUES
  ('diesel-litre', 0.14),
  ('petrol-litre', 0.13),
  ('hvo-litre', 2.43),
  ('wood-chips-kg', 1.33571),
  ('wood-pellets-kg', 1.67718)
) AS v("suffix", "biogenic_co2"),
"factor_libraries" l
WHERE l."id" = f."factor_library_id"
  AND l."name" = 'DEFRA'
  AND l."version" IN ('2025.2', '2026.1')
  AND f."external_id" = 'defra-' || split_part(l."version", '.', 1) || '-' || v."suffix"
  AND f."biogenic_co2" IS NULL;
