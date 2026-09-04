-- Project carbon: carbon EVM fields on carbon budget phases, granular
-- end-of-life (C1-C4) and replacement-cycle fields on embodied carbon
-- factors, whole-life carbon assessment, and subcontractor carbon flowdown.

-- ─── Carbon EVM on carbon_budget_phases ───────────────────────────────────────

ALTER TABLE "carbon_budget_phases" ADD COLUMN IF NOT EXISTS "percent_complete" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "carbon_budget_phases" ADD COLUMN IF NOT EXISTS "planned_completion_date" DATE;

-- ─── Granular end-of-life and replacement cycle on embodied carbon factors ───

ALTER TABLE "embodied_materials" ADD COLUMN IF NOT EXISTS "gwp_c1" DOUBLE PRECISION;
ALTER TABLE "embodied_materials" ADD COLUMN IF NOT EXISTS "gwp_c2" DOUBLE PRECISION;
ALTER TABLE "embodied_materials" ADD COLUMN IF NOT EXISTS "gwp_c3" DOUBLE PRECISION;
ALTER TABLE "embodied_materials" ADD COLUMN IF NOT EXISTS "gwp_c4" DOUBLE PRECISION;
ALTER TABLE "embodied_materials" ADD COLUMN IF NOT EXISTS "replacement_cycle_years" INTEGER;

ALTER TABLE "epd_records" ADD COLUMN IF NOT EXISTS "gwp_c1" DOUBLE PRECISION;
ALTER TABLE "epd_records" ADD COLUMN IF NOT EXISTS "gwp_c2" DOUBLE PRECISION;
ALTER TABLE "epd_records" ADD COLUMN IF NOT EXISTS "gwp_c3" DOUBLE PRECISION;
ALTER TABLE "epd_records" ADD COLUMN IF NOT EXISTS "gwp_c4" DOUBLE PRECISION;
ALTER TABLE "epd_records" ADD COLUMN IF NOT EXISTS "replacement_cycle_years" INTEGER;

-- ─── Whole-life carbon assessment (one per project) ───────────────────────────

CREATE TABLE IF NOT EXISTS "whole_life_carbon_assessments" (
  "id"                               TEXT NOT NULL,
  "organization_id"                  TEXT NOT NULL,
  "project_id"                       TEXT NOT NULL,
  "assessment_period_years"          INTEGER NOT NULL DEFAULT 60,
  "operational_start_date"           DATE,
  "operational_water_kg_co2e_manual" DECIMAL(18,4),
  "notes"                            TEXT,
  "created_by_user_id"               TEXT NOT NULL,
  "created_at"                       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "whole_life_carbon_assessments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whole_life_carbon_assessments_project_id_key"
  ON "whole_life_carbon_assessments"("project_id");

CREATE INDEX IF NOT EXISTS "whole_life_carbon_assessments_organization_id_idx"
  ON "whole_life_carbon_assessments"("organization_id");

DO $$ BEGIN
  ALTER TABLE "whole_life_carbon_assessments" ADD CONSTRAINT "whole_life_carbon_assessments_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "whole_life_carbon_assessments" ADD CONSTRAINT "whole_life_carbon_assessments_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "whole_life_carbon_assessments" ADD CONSTRAINT "whole_life_carbon_assessments_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Subcontractor carbon flowdown ─────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "SubcontractorSubmissionStatus" AS ENUM ('requested', 'submitted', 'verified', 'rejected', 'overdue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "subcontractor_carbon_submissions" (
  "id"                     TEXT NOT NULL,
  "organization_id"        TEXT NOT NULL,
  "contract_id"            TEXT NOT NULL,
  "subcontractor_name"     TEXT NOT NULL,
  "contact_email"          TEXT,
  "reporting_period_label" TEXT NOT NULL,
  "due_date"               DATE NOT NULL,
  "status"                 "SubcontractorSubmissionStatus" NOT NULL DEFAULT 'requested',
  "scope1_tco2e"           DECIMAL(18,4),
  "scope2_tco2e"           DECIMAL(18,4),
  "scope3_tco2e"           DECIMAL(18,4),
  "evidence_storage_key"   TEXT,
  "notes"                  TEXT,
  "requested_by_user_id"   TEXT NOT NULL,
  "submitted_at"           TIMESTAMP(3),
  "verified_by_user_id"    TEXT,
  "verified_at"            TIMESTAMP(3),
  "rejection_reason"       TEXT,
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "subcontractor_carbon_submissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "subcontractor_carbon_submissions_org_contract_status_idx"
  ON "subcontractor_carbon_submissions"("organization_id", "contract_id", "status");

CREATE INDEX IF NOT EXISTS "subcontractor_carbon_submissions_org_due_date_idx"
  ON "subcontractor_carbon_submissions"("organization_id", "due_date");

DO $$ BEGIN
  ALTER TABLE "subcontractor_carbon_submissions" ADD CONSTRAINT "subcontractor_carbon_submissions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "subcontractor_carbon_submissions" ADD CONSTRAINT "subcontractor_carbon_submissions_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "subcontractor_carbon_submissions" ADD CONSTRAINT "subcontractor_carbon_submissions_requested_by_user_id_fkey"
    FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "subcontractor_carbon_submissions" ADD CONSTRAINT "subcontractor_carbon_submissions_verified_by_user_id_fkey"
    FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
