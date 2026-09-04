-- Inventory foundation: organisational boundary, data provenance, base year
-- and restatements (GHG Protocol Corporate Standard ch. 3, 5 and 9).

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "ConsolidationApproach" AS ENUM ('operational_control', 'financial_control', 'equity_share');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DataOrigin" AS ENUM ('metered', 'invoiced', 'supplier_specific', 'calculated', 'estimated', 'proxy', 'extrapolated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StructuralChangeType" AS ENUM ('acquisition', 'divestiture', 'merger', 'outsourcing', 'insourcing', 'methodology_change', 'boundary_change', 'error_correction');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BaseYearStatus" AS ENUM ('draft', 'active', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RecalculationStatus" AS ENUM ('pending', 'not_significant', 'awaiting_approval', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RestatementReason" AS ENUM ('structural_change', 'methodology_change', 'factor_revision', 'error_correction', 'improved_data', 'boundary_change');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Organization: consolidation approach ────────────────────────────────────

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "consolidation_approach" "ConsolidationApproach" NOT NULL DEFAULT 'operational_control';

-- ─── Legal entities ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "legal_entities" (
  "id"                   TEXT NOT NULL,
  "organization_id"      TEXT NOT NULL,
  "name"                 TEXT NOT NULL,
  "registration_number"  TEXT,
  "country"              TEXT,
  "parent_id"            TEXT,
  "ownership_percent"    DECIMAL(6,3) NOT NULL DEFAULT 100,
  "operational_control"  BOOLEAN NOT NULL DEFAULT true,
  "financial_control"    BOOLEAN NOT NULL DEFAULT true,
  "acquired_on"          DATE,
  "divested_on"          DATE,
  "notes"                TEXT,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "legal_entities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "legal_entities_organization_id_idx" ON "legal_entities"("organization_id");
CREATE INDEX IF NOT EXISTS "legal_entities_organization_id_parent_id_idx" ON "legal_entities"("organization_id", "parent_id");

DO $$ BEGIN
  ALTER TABLE "legal_entities" ADD CONSTRAINT "legal_entities_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "legal_entities" ADD CONSTRAINT "legal_entities_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Facility enrichment ─────────────────────────────────────────────────────

ALTER TABLE "facilities"
  ADD COLUMN IF NOT EXISTS "address_line"        TEXT,
  ADD COLUMN IF NOT EXISTS "postcode"            TEXT,
  ADD COLUMN IF NOT EXISTS "latitude"            DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS "longitude"           DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS "site_type"           TEXT,
  ADD COLUMN IF NOT EXISTS "floor_area_m2"       DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "headcount"           INTEGER,
  ADD COLUMN IF NOT EXISTS "legal_entity_id"     TEXT,
  ADD COLUMN IF NOT EXISTS "operational_control" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "operational_from"    DATE,
  ADD COLUMN IF NOT EXISTS "operational_to"      DATE,
  ADD COLUMN IF NOT EXISTS "external_ref"        TEXT;

CREATE INDEX IF NOT EXISTS "facilities_organization_id_legal_entity_id_idx" ON "facilities"("organization_id", "legal_entity_id");

DO $$ BEGIN
  ALTER TABLE "facilities" ADD CONSTRAINT "facilities_legal_entity_id_fkey"
    FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Activity record provenance ──────────────────────────────────────────────
-- Existing rows default to 'estimated', the weakest tier, so nothing is
-- silently overstated as measured until a human or importer says otherwise.

ALTER TABLE "activity_records"
  ADD COLUMN IF NOT EXISTS "data_origin"      "DataOrigin" NOT NULL DEFAULT 'estimated',
  ADD COLUMN IF NOT EXISTS "data_origin_note" TEXT;

CREATE INDEX IF NOT EXISTS "activity_records_organization_id_data_origin_idx" ON "activity_records"("organization_id", "data_origin");

-- ─── Base years ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "base_years" (
  "id"                             TEXT NOT NULL,
  "organization_id"                TEXT NOT NULL,
  "reporting_period_id"            TEXT NOT NULL,
  "label"                          TEXT NOT NULL,
  "rationale"                      TEXT,
  "significance_threshold_percent" DECIMAL(6,3) NOT NULL DEFAULT 5,
  "status"                         "BaseYearStatus" NOT NULL DEFAULT 'draft',
  "original_scope1_co2e"           DECIMAL(18,6),
  "original_scope2_co2e"           DECIMAL(18,6),
  "original_scope3_co2e"           DECIMAL(18,6),
  "original_total_co2e"            DECIMAL(18,6),
  "current_scope1_co2e"            DECIMAL(18,6),
  "current_scope2_co2e"            DECIMAL(18,6),
  "current_scope3_co2e"            DECIMAL(18,6),
  "current_total_co2e"             DECIMAL(18,6),
  "locked_at"                      TIMESTAMP(3),
  "created_by_user_id"             TEXT NOT NULL,
  "created_at"                     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "base_years_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "base_years_organization_id_status_idx" ON "base_years"("organization_id", "status");

-- At most one active base year per organisation. Enforced in the database so a
-- concurrent write cannot produce two competing baselines.
CREATE UNIQUE INDEX IF NOT EXISTS "base_years_one_active_per_org"
  ON "base_years"("organization_id") WHERE "status" = 'active';

DO $$ BEGIN
  ALTER TABLE "base_years" ADD CONSTRAINT "base_years_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "base_years" ADD CONSTRAINT "base_years_reporting_period_id_fkey"
    FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "base_years" ADD CONSTRAINT "base_years_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Structural changes ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "structural_changes" (
  "id"                    TEXT NOT NULL,
  "organization_id"       TEXT NOT NULL,
  "type"                  "StructuralChangeType" NOT NULL,
  "effective_date"        DATE NOT NULL,
  "description"           TEXT NOT NULL,
  "legal_entity_id"       TEXT,
  "estimated_impact_co2e" DECIMAL(18,6),
  "notes"                 TEXT,
  "created_by_user_id"    TEXT NOT NULL,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "structural_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "structural_changes_organization_id_effective_date_idx" ON "structural_changes"("organization_id", "effective_date");

DO $$ BEGIN
  ALTER TABLE "structural_changes" ADD CONSTRAINT "structural_changes_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "structural_changes" ADD CONSTRAINT "structural_changes_legal_entity_id_fkey"
    FOREIGN KEY ("legal_entity_id") REFERENCES "legal_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "structural_changes" ADD CONSTRAINT "structural_changes_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Base year recalculations ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "base_year_recalculations" (
  "id"                    TEXT NOT NULL,
  "organization_id"       TEXT NOT NULL,
  "base_year_id"          TEXT NOT NULL,
  "structural_change_id"  TEXT NOT NULL,
  "status"                "RecalculationStatus" NOT NULL DEFAULT 'pending',
  "previous_scope1_co2e"  DECIMAL(18,6),
  "previous_scope2_co2e"  DECIMAL(18,6),
  "previous_scope3_co2e"  DECIMAL(18,6),
  "previous_total_co2e"   DECIMAL(18,6),
  "restated_scope1_co2e"  DECIMAL(18,6),
  "restated_scope2_co2e"  DECIMAL(18,6),
  "restated_scope3_co2e"  DECIMAL(18,6),
  "restated_total_co2e"   DECIMAL(18,6),
  "delta_percent"         DECIMAL(10,4),
  "is_significant"        BOOLEAN NOT NULL DEFAULT false,
  "method"                TEXT,
  "notes"                 TEXT,
  "approved_by_user_id"   TEXT,
  "approved_at"           TIMESTAMP(3),
  "created_by_user_id"    TEXT NOT NULL,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "base_year_recalculations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "base_year_recalculations_base_year_id_structural_change_id_key"
  ON "base_year_recalculations"("base_year_id", "structural_change_id");
CREATE INDEX IF NOT EXISTS "base_year_recalculations_organization_id_status_idx"
  ON "base_year_recalculations"("organization_id", "status");

DO $$ BEGIN
  ALTER TABLE "base_year_recalculations" ADD CONSTRAINT "base_year_recalculations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "base_year_recalculations" ADD CONSTRAINT "base_year_recalculations_base_year_id_fkey"
    FOREIGN KEY ("base_year_id") REFERENCES "base_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "base_year_recalculations" ADD CONSTRAINT "base_year_recalculations_structural_change_id_fkey"
    FOREIGN KEY ("structural_change_id") REFERENCES "structural_changes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "base_year_recalculations" ADD CONSTRAINT "base_year_recalculations_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "base_year_recalculations" ADD CONSTRAINT "base_year_recalculations_approved_by_user_id_fkey"
    FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Restatements ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "restatements" (
  "id"                      TEXT NOT NULL,
  "organization_id"         TEXT NOT NULL,
  "superseded_snapshot_id"  TEXT NOT NULL,
  "replacement_snapshot_id" TEXT,
  "reason"                  "RestatementReason" NOT NULL,
  "description"             TEXT NOT NULL,
  "previous_total_co2e"     DECIMAL(18,6),
  "restated_total_co2e"     DECIMAL(18,6),
  "delta_percent"           DECIMAL(10,4),
  "is_material"             BOOLEAN NOT NULL DEFAULT false,
  "disclosed_at"            TIMESTAMP(3),
  "created_by_user_id"      TEXT NOT NULL,
  "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"              TIMESTAMP(3) NOT NULL,
  CONSTRAINT "restatements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "restatements_organization_id_created_at_idx" ON "restatements"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "restatements_superseded_snapshot_id_idx" ON "restatements"("superseded_snapshot_id");

DO $$ BEGIN
  ALTER TABLE "restatements" ADD CONSTRAINT "restatements_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "restatements" ADD CONSTRAINT "restatements_superseded_snapshot_id_fkey"
    FOREIGN KEY ("superseded_snapshot_id") REFERENCES "published_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "restatements" ADD CONSTRAINT "restatements_replacement_snapshot_id_fkey"
    FOREIGN KEY ("replacement_snapshot_id") REFERENCES "published_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "restatements" ADD CONSTRAINT "restatements_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
