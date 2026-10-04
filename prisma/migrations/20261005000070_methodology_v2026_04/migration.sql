-- Methodology ghg-protocol-v2026-04 (lib/calculation/methodology.ts): a record on
-- an EPA run that the EPA library has no factor for is priced from the DEFRA set
-- for the period, then ADEME, with a warning (grid electricity and heat never fall
-- back), instead of being saved at 0 kg CO2e. New runs use the newest row;
-- published snapshots keep the version they were calculated with. Additive.
INSERT INTO "methodology_versions" ("id", "name", "gwp_version", "notes", "created_at")
VALUES (
  gen_random_uuid()::text,
  'ghg-protocol-v2026-04',
  'AR6',
  'A record the EPA library has no factor for is priced from DEFRA, then ADEME, with a warning; grid electricity and heat never fall back',
  now()
)
ON CONFLICT ("name") DO NOTHING;
