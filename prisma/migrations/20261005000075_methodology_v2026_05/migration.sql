-- Methodology ghg-protocol-v2026-05 (lib/calculation/methodology.ts): library
-- fallback also applies to runs on the NGA, ECCC, UBA and SEAI national
-- libraries, and Australian state / Canadian province grid factors are used
-- when the record or its facility names the region. New runs use the newest
-- row; published snapshots keep the version they were calculated with. Additive.
INSERT INTO "methodology_versions" ("id", "name", "gwp_version", "notes", "created_at")
VALUES (
  gen_random_uuid()::text,
  'ghg-protocol-v2026-05',
  'AR6',
  'Library fallback also covers the NGA, ECCC, UBA and SEAI national libraries; Australian and Canadian state and province grid factors are used when the record or its facility names the region',
  now()
)
ON CONFLICT ("name") DO NOTHING;
