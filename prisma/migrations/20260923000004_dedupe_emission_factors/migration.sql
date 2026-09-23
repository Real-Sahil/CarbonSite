-- Older seed runs inserted 35 DEFRA 2025 factors twice (same library, same
-- external_id, same values). Selection picks among identical rows, but the
-- library shows inflated counts and an import could not tell which copy to
-- supersede. Delete the extra copies, keeping the one any calculation
-- references (none reference both), then enforce one row per external_id per
-- library. Rows without an external_id are untouched (NULLs are distinct).
DELETE FROM "emission_factors" f
USING (
  SELECT id,
         row_number() OVER (
           PARTITION BY factor_library_id, external_id
           ORDER BY EXISTS (SELECT 1 FROM "emission_calculations" c WHERE c.emission_factor_id = f2.id) DESC, id
         ) AS rn
  FROM "emission_factors" f2
  WHERE external_id IS NOT NULL
) d
WHERE f.id = d.id
  AND d.rn > 1
  AND NOT EXISTS (SELECT 1 FROM "emission_calculations" c WHERE c.emission_factor_id = f.id);

-- CreateIndex
CREATE UNIQUE INDEX "emission_factors_factor_library_id_external_id_key" ON "emission_factors"("factor_library_id", "external_id");
