-- Phase H: Ecological Live Data Scan
-- Adds EcologicalScan model: live fetch from NBN Atlas (flora/fauna), Natural England MAGIC
-- (designated sites), and Forestry Commission NI (woodland) triggered by project postcode.

-- ─── Project: add postcode field ─────────────────────────────────────────────
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "postcode" TEXT;

-- ─── ReportType enum: add ecology_survey ─────────────────────────────────────
DO $$ BEGIN
  ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'ecology_survey';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── EcologicalScanStatus enum ───────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "ecological_scan_status" AS ENUM (
    'pending', 'running', 'completed', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── EcologicalScan table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ecological_scans" (
  "id"                      TEXT NOT NULL,
  "organization_id"         TEXT NOT NULL,
  "project_id"              TEXT NOT NULL,
  "postcode"                TEXT NOT NULL,
  "radius_km"               DECIMAL(6,2) NOT NULL DEFAULT 1,
  "status"                  "ecological_scan_status" NOT NULL DEFAULT 'pending',
  "scanned_at"              TIMESTAMPTZ,
  "error_message"           TEXT,

  -- NBN Atlas species counts
  "total_species_count"     INTEGER NOT NULL DEFAULT 0,
  "plant_species_count"     INTEGER NOT NULL DEFAULT 0,
  "bird_species_count"      INTEGER NOT NULL DEFAULT 0,
  "mammal_species_count"    INTEGER NOT NULL DEFAULT 0,
  "invert_species_count"    INTEGER NOT NULL DEFAULT 0,
  "reptile_species_count"   INTEGER NOT NULL DEFAULT 0,
  "amphibian_species_count" INTEGER NOT NULL DEFAULT 0,
  "other_species_count"     INTEGER NOT NULL DEFAULT 0,
  "species_records"         JSONB NOT NULL DEFAULT '[]',

  -- MAGIC designated sites
  "designated_sites"        JSONB NOT NULL DEFAULT '[]',
  "sssi_count"              INTEGER NOT NULL DEFAULT 0,
  "sac_count"               INTEGER NOT NULL DEFAULT 0,
  "spa_count"               INTEGER NOT NULL DEFAULT 0,
  "nvr_count"               INTEGER NOT NULL DEFAULT 0,
  "ancient_woodland_count"  INTEGER NOT NULL DEFAULT 0,

  -- Forestry Commission woodland
  "woodland_data"           JSONB NOT NULL DEFAULT '[]',
  "woodland_total_ha"       DECIMAL(14,4) NOT NULL DEFAULT 0,
  "broadleaf_ha"            DECIMAL(14,4) NOT NULL DEFAULT 0,
  "conifer_ha"              DECIMAL(14,4) NOT NULL DEFAULT 0,
  "mixed_woodland_ha"       DECIMAL(14,4) NOT NULL DEFAULT 0,

  "created_by_user_id"      TEXT NOT NULL,
  "created_at"              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "ecological_scans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ecological_scans_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "ecological_scans_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "ecological_scans_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "ecological_scans_organization_id_project_id_created_at_idx"
  ON "ecological_scans"("organization_id", "project_id", "created_at");
