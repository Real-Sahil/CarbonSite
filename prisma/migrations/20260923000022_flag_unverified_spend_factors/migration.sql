-- The seeded spend-based (EEIO) factors have no traceable source or price
-- year, so none of them can be inflation-adjusted and their values are
-- unconfirmed. Say so on the factor itself (shown wherever the factor is
-- listed and in each calculation's factor detail) instead of leaving them
-- looking authoritative. No calculation has used them (checked 2026-09-23).
-- Additive: text and rating only, idempotent.

-- DESNZ/DEFRA conversion factors do not include spend-based factors; these
-- four were hand-entered with the 2025.1 library and carried forward.
UPDATE "emission_factors"
SET "usage_notes" = coalesce("usage_notes", '') ||
      ' Unverified: DESNZ conversion factors do not include spend-based factors, so this value has no traceable source or price year and is not adjusted for inflation. Prefer an activity-based factor or supplier-specific data.',
    "uncertainty_rating" = 'high'
WHERE "external_id" LIKE 'eeio-2025-%'
  AND upper("input_unit") = 'GBP'
  AND coalesce("usage_notes", '') NOT LIKE '%Unverified:%';

-- EPA publishes USEEIO v1.3 per 6-digit NAICS in 2022 USD at purchaser
-- prices. These 3-digit values have not been checked against that dataset.
UPDATE "emission_factors"
SET "usage_notes" = coalesce("usage_notes", '') ||
      ' Unverified: EPA publishes USEEIO v1.3 per 6-digit NAICS in 2022 USD; this 3-digit value has not been checked against that dataset, so no price year is set. Load the published factors with scripts/build-useeio-factors.ts.',
    "uncertainty_rating" = 'high'
WHERE "external_id" LIKE 'useeio-v1.3-naics-%'
  AND "external_id" NOT LIKE 'useeio-v1.3-naics6-%'
  AND upper("input_unit") = 'USD'
  AND coalesce("usage_notes", '') NOT LIKE '%Unverified:%';
