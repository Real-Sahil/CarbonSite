-- Biodiversity Net Gain, protected species, and the 30 year management and
-- monitoring obligation that follows a BNG consent.

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "BiodiversityModule" AS ENUM ('area', 'hedgerow', 'watercourse');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "HabitatDistinctiveness" AS ENUM ('very_low', 'low', 'medium', 'high', 'very_high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "HabitatCondition" AS ENUM ('not_assessed', 'poor', 'fairly_poor', 'moderate', 'fairly_good', 'good');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StrategicSignificance" AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CreationDifficulty" AS ENUM ('low', 'medium', 'high', 'very_high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SpatialRisk" AS ENUM ('on_site', 'outside_neighbouring', 'outside_distant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ParcelStage" AS ENUM ('baseline', 'retained', 'enhanced', 'created');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AssessmentStatus" AS ENUM ('draft', 'submitted', 'approved', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SecuringMechanism" AS ENUM ('section_106', 'conservation_covenant', 'planning_condition', 'statutory_credits', 'not_yet_secured');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SpeciesLicenceStatus" AS ENUM ('not_required', 'required', 'applied', 'granted', 'refused', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MonitoringEventStatus" AS ENUM ('scheduled', 'due', 'completed', 'overdue', 'remediation_required', 'waived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Biodiversity assessments ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "biodiversity_assessments" (
  "id"                          TEXT NOT NULL,
  "organization_id"             TEXT NOT NULL,
  "project_id"                  TEXT,
  "site_id"                     TEXT,
  "name"                        TEXT NOT NULL,
  "reference"                   TEXT,
  "status"                      "AssessmentStatus" NOT NULL DEFAULT 'draft',
  "metric_version"              TEXT NOT NULL DEFAULT 'statutory-biodiversity-metric',
  "planning_authority"          TEXT,
  "planning_reference"          TEXT,
  "assessment_date"             DATE,
  "ecologist_name"              TEXT,
  "ecologist_organisation"      TEXT,
  "baseline_area_units"         DECIMAL(18,6) NOT NULL DEFAULT 0,
  "baseline_hedgerow_units"     DECIMAL(18,6) NOT NULL DEFAULT 0,
  "baseline_watercourse_units"  DECIMAL(18,6) NOT NULL DEFAULT 0,
  "post_area_units"             DECIMAL(18,6) NOT NULL DEFAULT 0,
  "post_hedgerow_units"         DECIMAL(18,6) NOT NULL DEFAULT 0,
  "post_watercourse_units"      DECIMAL(18,6) NOT NULL DEFAULT 0,
  "meets_requirement"           BOOLEAN NOT NULL DEFAULT false,
  "securing_mechanism"          "SecuringMechanism" NOT NULL DEFAULT 'not_yet_secured',
  "secured_from"                DATE,
  "notes"                       TEXT,
  "created_by_user_id"          TEXT NOT NULL,
  "created_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "biodiversity_assessments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "biodiversity_assessments_org_status_idx" ON "biodiversity_assessments"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "biodiversity_assessments_org_project_idx" ON "biodiversity_assessments"("organization_id", "project_id");

DO $$ BEGIN
  ALTER TABLE "biodiversity_assessments" ADD CONSTRAINT "biodiversity_assessments_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "biodiversity_assessments" ADD CONSTRAINT "biodiversity_assessments_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "biodiversity_assessments" ADD CONSTRAINT "biodiversity_assessments_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "biodiversity_assessments" ADD CONSTRAINT "biodiversity_assessments_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Habitat parcels ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "habitat_parcels" (
  "id"                        TEXT NOT NULL,
  "organization_id"           TEXT NOT NULL,
  "assessment_id"             TEXT NOT NULL,
  "stage"                     "ParcelStage" NOT NULL,
  "module"                    "BiodiversityModule" NOT NULL,
  "broad_habitat"             TEXT NOT NULL,
  "habitat_type"              TEXT NOT NULL,
  "size"                      DECIMAL(14,4) NOT NULL,
  "distinctiveness"           "HabitatDistinctiveness" NOT NULL,
  "condition"                 "HabitatCondition" NOT NULL DEFAULT 'not_assessed',
  "strategic_significance"    "StrategicSignificance" NOT NULL DEFAULT 'low',
  "difficulty"                "CreationDifficulty" NOT NULL DEFAULT 'low',
  "years_to_target_condition" INTEGER NOT NULL DEFAULT 0,
  "spatial_risk"              "SpatialRisk" NOT NULL DEFAULT 'on_site',
  "units"                     DECIMAL(18,6) NOT NULL DEFAULT 0,
  "calculation"               TEXT,
  "parcel_reference"          TEXT,
  "notes"                     TEXT,
  "created_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                TIMESTAMP(3) NOT NULL,
  CONSTRAINT "habitat_parcels_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "habitat_parcels_org_assessment_idx" ON "habitat_parcels"("organization_id", "assessment_id");
CREATE INDEX IF NOT EXISTS "habitat_parcels_assessment_stage_module_idx" ON "habitat_parcels"("assessment_id", "stage", "module");

DO $$ BEGIN
  ALTER TABLE "habitat_parcels" ADD CONSTRAINT "habitat_parcels_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "habitat_parcels" ADD CONSTRAINT "habitat_parcels_assessment_id_fkey"
    FOREIGN KEY ("assessment_id") REFERENCES "biodiversity_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Protected species records ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "protected_species_records" (
  "id"                  TEXT NOT NULL,
  "organization_id"     TEXT NOT NULL,
  "assessment_id"       TEXT,
  "site_id"             TEXT,
  "project_id"          TEXT,
  "species"             TEXT NOT NULL,
  "legal_protection"    TEXT,
  "survey_date"         DATE,
  "survey_name"         TEXT,
  "findings"            TEXT NOT NULL,
  "licence_status"      "SpeciesLicenceStatus" NOT NULL DEFAULT 'not_required',
  "licence_reference"   TEXT,
  "licence_expires_on"  DATE,
  "mitigation"          TEXT,
  "seasonal_constraint" TEXT,
  "notes"               TEXT,
  "created_by_user_id"  TEXT NOT NULL,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "protected_species_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "protected_species_records_org_licence_idx" ON "protected_species_records"("organization_id", "licence_status");
CREATE INDEX IF NOT EXISTS "protected_species_records_org_assessment_idx" ON "protected_species_records"("organization_id", "assessment_id");

DO $$ BEGIN
  ALTER TABLE "protected_species_records" ADD CONSTRAINT "protected_species_records_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "protected_species_records" ADD CONSTRAINT "protected_species_records_assessment_id_fkey"
    FOREIGN KEY ("assessment_id") REFERENCES "biodiversity_assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "protected_species_records" ADD CONSTRAINT "protected_species_records_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "protected_species_records" ADD CONSTRAINT "protected_species_records_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "protected_species_records" ADD CONSTRAINT "protected_species_records_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Habitat management plans ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "habitat_management_plans" (
  "id"                    TEXT NOT NULL,
  "organization_id"       TEXT NOT NULL,
  "assessment_id"         TEXT NOT NULL,
  "title"                 TEXT NOT NULL,
  "responsible_party"     TEXT,
  "commences_on"          DATE NOT NULL,
  "ends_on"               DATE NOT NULL,
  "management_objectives" TEXT,
  "prescriptions"         TEXT,
  "remediation_strategy"  TEXT,
  "funding_secured"       DECIMAL(18,2),
  "funding_currency"      TEXT,
  "notes"                 TEXT,
  "created_by_user_id"    TEXT NOT NULL,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "habitat_management_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "habitat_management_plans_assessment_id_key" ON "habitat_management_plans"("assessment_id");
CREATE INDEX IF NOT EXISTS "habitat_management_plans_org_idx" ON "habitat_management_plans"("organization_id");

DO $$ BEGIN
  ALTER TABLE "habitat_management_plans" ADD CONSTRAINT "habitat_management_plans_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "habitat_management_plans" ADD CONSTRAINT "habitat_management_plans_assessment_id_fkey"
    FOREIGN KEY ("assessment_id") REFERENCES "biodiversity_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "habitat_management_plans" ADD CONSTRAINT "habitat_management_plans_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Ecological monitoring events ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ecological_monitoring_events" (
  "id"                 TEXT NOT NULL,
  "organization_id"    TEXT NOT NULL,
  "management_plan_id" TEXT NOT NULL,
  "parcel_id"          TEXT,
  "monitoring_year"    INTEGER NOT NULL,
  "due_on"             DATE NOT NULL,
  "status"             "MonitoringEventStatus" NOT NULL DEFAULT 'scheduled',
  "completed_on"       DATE,
  "surveyor_name"      TEXT,
  "condition_found"    "HabitatCondition",
  "on_track"           BOOLEAN,
  "findings"           TEXT,
  "remedial_action"    TEXT,
  "report_evidence_id" TEXT,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ecological_monitoring_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ecological_monitoring_events_org_status_due_idx" ON "ecological_monitoring_events"("organization_id", "status", "due_on");
CREATE INDEX IF NOT EXISTS "ecological_monitoring_events_plan_year_idx" ON "ecological_monitoring_events"("management_plan_id", "monitoring_year");

DO $$ BEGIN
  ALTER TABLE "ecological_monitoring_events" ADD CONSTRAINT "ecological_monitoring_events_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ecological_monitoring_events" ADD CONSTRAINT "ecological_monitoring_events_management_plan_id_fkey"
    FOREIGN KEY ("management_plan_id") REFERENCES "habitat_management_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ecological_monitoring_events" ADD CONSTRAINT "ecological_monitoring_events_parcel_id_fkey"
    FOREIGN KEY ("parcel_id") REFERENCES "habitat_parcels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
