-- Idempotent replacement for 20260922000000_sv_foundation.
-- That migration left a "failed" row in _prisma_migrations (P3009).
-- This migration is safe to run whether or not the original DDL was partially applied:
-- all CREATE TYPE uses duplicate_object guard; all CREATE TABLE uses IF NOT EXISTS;
-- all ADD CONSTRAINT uses duplicate_object guard.

-- ── Enums ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "sv_commitment_status" AS ENUM ('draft', 'active', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "sv_activity_status" AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── AlterTable: add tender fields to contracts ────────────────────────────────
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "tender_reference"       TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "procuring_authority"    TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "social_value_weighting" DECIMAL(5,2);
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "sv_toolkit_theme"       TEXT;

-- ── sv_frameworks ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sv_frameworks" (
    "id"              TEXT        NOT NULL,
    "organization_id" TEXT        NOT NULL,
    "name"            TEXT        NOT NULL,
    "slug"            TEXT        NOT NULL,
    "version"         TEXT,
    "description"     TEXT,
    "is_default"      BOOLEAN     NOT NULL DEFAULT false,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sv_frameworks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sv_frameworks_organization_id_slug_key" ON "sv_frameworks"("organization_id", "slug");
CREATE INDEX IF NOT EXISTS "sv_frameworks_organization_id_idx" ON "sv_frameworks"("organization_id");

-- ── sv_themes ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sv_themes" (
    "id"           TEXT        NOT NULL,
    "framework_id" TEXT        NOT NULL,
    "name"         TEXT        NOT NULL,
    "code"         TEXT        NOT NULL,
    "description"  TEXT,
    "sort_order"   INTEGER     NOT NULL DEFAULT 0,
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sv_themes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sv_themes_framework_id_code_key" ON "sv_themes"("framework_id", "code");
CREATE INDEX IF NOT EXISTS "sv_themes_framework_id_idx" ON "sv_themes"("framework_id");

-- ── sv_outcomes ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sv_outcomes" (
    "id"             TEXT          NOT NULL,
    "theme_id"       TEXT          NOT NULL,
    "name"           TEXT          NOT NULL,
    "code"           TEXT          NOT NULL,
    "description"    TEXT,
    "unit"           TEXT,
    "value_per_unit" DECIMAL(18,2),
    "currency"       TEXT          NOT NULL DEFAULT 'GBP',
    "sort_order"     INTEGER       NOT NULL DEFAULT 0,
    "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sv_outcomes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sv_outcomes_theme_id_code_key" ON "sv_outcomes"("theme_id", "code");
CREATE INDEX IF NOT EXISTS "sv_outcomes_theme_id_idx" ON "sv_outcomes"("theme_id");

-- ── sv_measures ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sv_measures" (
    "id"          TEXT        NOT NULL,
    "outcome_id"  TEXT        NOT NULL,
    "name"        TEXT        NOT NULL,
    "unit"        TEXT        NOT NULL,
    "description" TEXT,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sv_measures_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sv_measures_outcome_id_idx" ON "sv_measures"("outcome_id");

-- ── sv_indicators ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sv_indicators" (
    "id"          TEXT        NOT NULL,
    "outcome_id"  TEXT        NOT NULL,
    "name"        TEXT        NOT NULL,
    "description" TEXT,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sv_indicators_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sv_indicators_outcome_id_idx" ON "sv_indicators"("outcome_id");

-- ── sv_commitments ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sv_commitments" (
    "id"                   TEXT                    NOT NULL,
    "organization_id"      TEXT                    NOT NULL,
    "contract_id"          TEXT,
    "framework_id"         TEXT,
    "owner_user_id"        TEXT,
    "title"                TEXT                    NOT NULL,
    "description"          TEXT,
    "target_value"         DECIMAL(18,2),
    "target_unit"          TEXT,
    "target_date"          DATE,
    "reporting_period_id"  TEXT,
    "status"               "sv_commitment_status"  NOT NULL DEFAULT 'draft',
    "monetised_value"      DECIMAL(18,2),
    "currency"             TEXT                    NOT NULL DEFAULT 'GBP',
    "created_at"           TIMESTAMPTZ             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMPTZ             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sv_commitments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sv_commitments_org_status_idx"   ON "sv_commitments"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "sv_commitments_org_contract_idx" ON "sv_commitments"("organization_id", "contract_id");

-- ── sv_activities ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sv_activities" (
    "id"                    TEXT                   NOT NULL,
    "organization_id"       TEXT                   NOT NULL,
    "commitment_id"         TEXT,
    "measure_id"            TEXT,
    "facility_id"           TEXT,
    "reporting_period_id"   TEXT,
    "submitted_by_user_id"  TEXT,
    "approved_by_user_id"   TEXT,
    "title"                 TEXT                   NOT NULL,
    "description"           TEXT,
    "activity_date"         DATE                   NOT NULL,
    "quantity_value"        DECIMAL(18,4),
    "quantity_unit"         TEXT,
    "monetised_value"       DECIMAL(18,2),
    "currency"              TEXT                   NOT NULL DEFAULT 'GBP',
    "status"                "sv_activity_status"   NOT NULL DEFAULT 'draft',
    "review_notes"          TEXT,
    "evidence_urls"         TEXT[]                 NOT NULL DEFAULT '{}',
    "ai_extracted"          BOOLEAN                NOT NULL DEFAULT false,
    "ai_confidence"         DECIMAL(5,4),
    "ai_raw_response"       JSONB,
    "created_at"            TIMESTAMPTZ            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMPTZ            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sv_activities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sv_activities_org_status_idx"     ON "sv_activities"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "sv_activities_org_commitment_idx" ON "sv_activities"("organization_id", "commitment_id");
CREATE INDEX IF NOT EXISTS "sv_activities_org_date_idx"       ON "sv_activities"("organization_id", "activity_date");

-- ── carbon_signals ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "carbon_signals" (
    "id"              TEXT          NOT NULL,
    "organization_id" TEXT          NOT NULL,
    "signal_type"     TEXT          NOT NULL,
    "source"          TEXT          NOT NULL,
    "region"          TEXT,
    "value"           DECIMAL(18,6) NOT NULL,
    "unit"            TEXT          NOT NULL,
    "recorded_at"     TIMESTAMPTZ   NOT NULL,
    "raw_payload"     JSONB,
    "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "carbon_signals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "carbon_signals_org_type_time_idx" ON "carbon_signals"("organization_id", "signal_type", "recorded_at");

-- ── impact_alerts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "impact_alerts" (
    "id"                    TEXT        NOT NULL,
    "organization_id"       TEXT        NOT NULL,
    "alert_type"            TEXT        NOT NULL,
    "severity"              TEXT        NOT NULL DEFAULT 'medium',
    "title"                 TEXT        NOT NULL,
    "message"               TEXT        NOT NULL,
    "resource_type"         TEXT,
    "resource_id"           TEXT,
    "resolved_at"           TIMESTAMPTZ,
    "resolved_by_user_id"   TEXT,
    "metadata"              JSONB       NOT NULL DEFAULT '{}',
    "created_at"            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "impact_alerts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "impact_alerts_org_type_time_idx" ON "impact_alerts"("organization_id", "alert_type", "created_at");
CREATE INDEX IF NOT EXISTS "impact_alerts_org_resolved_idx"  ON "impact_alerts"("organization_id", "resolved_at");

-- ── geographic_impacts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "geographic_impacts" (
    "id"              TEXT          NOT NULL,
    "organization_id" TEXT          NOT NULL,
    "impact_type"     TEXT          NOT NULL,
    "label"           TEXT          NOT NULL,
    "latitude"        DECIMAL(9,6)  NOT NULL,
    "longitude"       DECIMAL(9,6)  NOT NULL,
    "radius_metres"   INTEGER,
    "value"           DECIMAL(18,4),
    "unit"            TEXT,
    "metadata"        JSONB         NOT NULL DEFAULT '{}',
    "recorded_at"     TIMESTAMPTZ   NOT NULL,
    "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "geographic_impacts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "geographic_impacts_org_type_time_idx" ON "geographic_impacts"("organization_id", "impact_type", "recorded_at");

-- ── external_api_credentials ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "external_api_credentials" (
    "id"                TEXT        NOT NULL,
    "organization_id"   TEXT        NOT NULL,
    "provider"          TEXT        NOT NULL,
    "label"             TEXT,
    "encrypted_key"     TEXT        NOT NULL,
    "scopes"            TEXT[]      NOT NULL DEFAULT '{}',
    "last_validated_at" TIMESTAMPTZ,
    "is_active"         BOOLEAN     NOT NULL DEFAULT true,
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_api_credentials_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "external_api_credentials_org_provider_key" ON "external_api_credentials"("organization_id", "provider");
CREATE INDEX IF NOT EXISTS "external_api_credentials_org_active_idx" ON "external_api_credentials"("organization_id", "is_active");

-- ── Foreign key constraints (all guarded against duplicate_object) ────────────

DO $$ BEGIN
  ALTER TABLE "sv_frameworks" ADD CONSTRAINT "sv_frameworks_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sv_themes" ADD CONSTRAINT "sv_themes_framework_id_fkey"
    FOREIGN KEY ("framework_id") REFERENCES "sv_frameworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sv_outcomes" ADD CONSTRAINT "sv_outcomes_theme_id_fkey"
    FOREIGN KEY ("theme_id") REFERENCES "sv_themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sv_measures" ADD CONSTRAINT "sv_measures_outcome_id_fkey"
    FOREIGN KEY ("outcome_id") REFERENCES "sv_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sv_indicators" ADD CONSTRAINT "sv_indicators_outcome_id_fkey"
    FOREIGN KEY ("outcome_id") REFERENCES "sv_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sv_commitments" ADD CONSTRAINT "sv_commitments_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sv_commitments" ADD CONSTRAINT "sv_commitments_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sv_commitments" ADD CONSTRAINT "sv_commitments_framework_id_fkey"
    FOREIGN KEY ("framework_id") REFERENCES "sv_frameworks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sv_commitments" ADD CONSTRAINT "sv_commitments_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sv_commitments" ADD CONSTRAINT "sv_commitments_reporting_period_id_fkey"
    FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sv_activities" ADD CONSTRAINT "sv_activities_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sv_activities" ADD CONSTRAINT "sv_activities_commitment_id_fkey"
    FOREIGN KEY ("commitment_id") REFERENCES "sv_commitments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sv_activities" ADD CONSTRAINT "sv_activities_measure_id_fkey"
    FOREIGN KEY ("measure_id") REFERENCES "sv_measures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sv_activities" ADD CONSTRAINT "sv_activities_facility_id_fkey"
    FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sv_activities" ADD CONSTRAINT "sv_activities_reporting_period_id_fkey"
    FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sv_activities" ADD CONSTRAINT "sv_activities_submitted_by_user_id_fkey"
    FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "sv_activities" ADD CONSTRAINT "sv_activities_approved_by_user_id_fkey"
    FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "carbon_signals" ADD CONSTRAINT "carbon_signals_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "impact_alerts" ADD CONSTRAINT "impact_alerts_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "impact_alerts" ADD CONSTRAINT "impact_alerts_resolved_by_user_id_fkey"
    FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "geographic_impacts" ADD CONSTRAINT "geographic_impacts_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "external_api_credentials" ADD CONSTRAINT "external_api_credentials_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
