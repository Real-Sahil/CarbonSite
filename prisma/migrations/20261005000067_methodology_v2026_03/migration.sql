-- Methodology ghg-protocol-v2026-03 (lib/calculation/methodology.ts): a bare
-- "gallon" or "gallons" is read as a US gallon for a record whose country is
-- the United States (3.785 L, not the imperial 4.546 L), with a warning on the
-- calculation. New runs use the newest row; published snapshots keep the
-- version they were calculated with. Additive.
INSERT INTO "methodology_versions" ("id", "name", "gwp_version", "notes", "created_at")
VALUES (
  gen_random_uuid()::text,
  'ghg-protocol-v2026-03',
  'AR6',
  'Bare gallon units follow the record''s country: US gallons for United States records, imperial gallons elsewhere, with a note on the calculation',
  now()
)
ON CONFLICT ("name") DO NOTHING;
