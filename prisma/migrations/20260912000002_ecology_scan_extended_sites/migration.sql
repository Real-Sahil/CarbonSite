-- Phase H extension: add Ramsar, AONB, LNR counts and Priority Habitat area
-- to ecological_scans. All nullable-safe with defaults so no backfill needed.

ALTER TABLE "ecological_scans"
  ADD COLUMN IF NOT EXISTS "ramsar_count"        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "aonb_count"          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lnr_count"           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "priority_habitat_ha" DECIMAL(14,4) NOT NULL DEFAULT 0;
