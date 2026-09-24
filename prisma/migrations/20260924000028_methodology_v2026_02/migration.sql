-- Methodology ghg-protocol-v2026-02 (lib/calculation/methodology.ts): spend
-- priced by industry from the currency's spend library, EUR / France HICP
-- deflation, net-CV fuel units, and purchased heat under Scope 2. New runs use
-- the newest row; published snapshots keep the version they were calculated
-- with. Additive.
INSERT INTO "methodology_versions" ("id", "name", "gwp_version", "notes", "created_at")
VALUES (
  gen_random_uuid()::text,
  'ghg-protocol-v2026-02',
  'AR6',
  'Adds industry-priced spend from the currency''s spend library, the France HICP for French spend factors, and net-CV fuel units',
  now()
)
ON CONFLICT ("name") DO NOTHING;
