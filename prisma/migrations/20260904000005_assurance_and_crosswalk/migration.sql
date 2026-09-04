-- Assurance engagements (ISAE 3000 / ISO 14064-3 workspace) and the framework
-- datapoint crosswalk for ESRS E1, GRI 305, CDP, SECR and IFRS S2.

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "AssuranceLevel" AS ENUM ('limited', 'reasonable');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AssuranceStandard" AS ENUM ('isae_3000', 'iso_14064_3', 'aa1000as', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EngagementStatus" AS ENUM ('planning', 'fieldwork', 'review', 'signed', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EvidenceRequestStatus" AS ENUM ('requested', 'provided', 'not_available', 'not_applicable');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SamplingMethod" AS ENUM ('full_population', 'risk_based', 'random', 'targeted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SampleResult" AS ENUM ('pending', 'pass', 'exception_resolved', 'fail');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FindingSeverity" AS ENUM ('observation', 'minor', 'significant', 'material_misstatement');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FindingStatus" AS ENUM ('open', 'management_responded', 'resolved', 'qualified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SupportedFramework" AS ENUM ('esrs_e1', 'gri_305', 'cdp_climate', 'secr', 'ifrs_s2', 'ghg_protocol');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DatapointStatus" AS ENUM ('satisfied', 'partial', 'gap', 'not_applicable');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Assurance engagements ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "assurance_engagements" (
  "id"                             TEXT NOT NULL,
  "organization_id"                TEXT NOT NULL,
  "reporting_period_id"            TEXT NOT NULL,
  "snapshot_id"                    TEXT,
  "standard"                       "AssuranceStandard" NOT NULL DEFAULT 'isae_3000',
  "level"                          "AssuranceLevel" NOT NULL DEFAULT 'limited',
  "status"                         "EngagementStatus" NOT NULL DEFAULT 'planning',
  "provider_name"                  TEXT NOT NULL,
  "lead_assuror_name"              TEXT NOT NULL,
  "lead_assuror_email"             TEXT,
  "materiality_threshold_co2e"     DECIMAL(18,4),
  "materiality_threshold_percent"  DECIMAL(6,3),
  "scope_description"              TEXT,
  "engagement_letter_evidence_id"  TEXT,
  "planned_start_date"             DATE,
  "planned_end_date"               DATE,
  "opinion_issued_at"              TIMESTAMP(3),
  "opinion_summary"                TEXT,
  "representation_letter_evidence_id" TEXT,
  "created_by_user_id"             TEXT NOT NULL,
  "created_at"                     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assurance_engagements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "assurance_engagements_org_status_idx" ON "assurance_engagements"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "assurance_engagements_org_period_idx" ON "assurance_engagements"("organization_id", "reporting_period_id");

DO $$ BEGIN
  ALTER TABLE "assurance_engagements" ADD CONSTRAINT "assurance_engagements_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "assurance_engagements" ADD CONSTRAINT "assurance_engagements_reporting_period_id_fkey"
    FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "assurance_engagements" ADD CONSTRAINT "assurance_engagements_snapshot_id_fkey"
    FOREIGN KEY ("snapshot_id") REFERENCES "published_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "assurance_engagements" ADD CONSTRAINT "assurance_engagements_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Evidence requests (PBC list) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "evidence_requests" (
  "id"                     TEXT NOT NULL,
  "organization_id"        TEXT NOT NULL,
  "engagement_id"          TEXT NOT NULL,
  "reference"               TEXT NOT NULL,
  "description"            TEXT NOT NULL,
  "category"               TEXT,
  "owner_user_id"          TEXT,
  "status"                 "EvidenceRequestStatus" NOT NULL DEFAULT 'requested',
  "requested_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "due_on"                 DATE,
  "provided_at"            TIMESTAMP(3),
  "evidence_file_id"       TEXT,
  "unavailability_reason"  TEXT,
  "notes"                  TEXT,
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMP(3) NOT NULL,
  CONSTRAINT "evidence_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "evidence_requests_engagement_id_reference_key" ON "evidence_requests"("engagement_id", "reference");
CREATE INDEX IF NOT EXISTS "evidence_requests_org_status_idx" ON "evidence_requests"("organization_id", "status");

DO $$ BEGIN
  ALTER TABLE "evidence_requests" ADD CONSTRAINT "evidence_requests_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "evidence_requests" ADD CONSTRAINT "evidence_requests_engagement_id_fkey"
    FOREIGN KEY ("engagement_id") REFERENCES "assurance_engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "evidence_requests" ADD CONSTRAINT "evidence_requests_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Assurance samples ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "assurance_samples" (
  "id"                       TEXT NOT NULL,
  "organization_id"          TEXT NOT NULL,
  "engagement_id"            TEXT NOT NULL,
  "emission_calculation_id"  TEXT,
  "activity_record_id"       TEXT,
  "sampling_method"          "SamplingMethod" NOT NULL,
  "selection_rationale"      TEXT NOT NULL,
  "test_procedure"           TEXT NOT NULL,
  "result"                   "SampleResult" NOT NULL DEFAULT 'pending',
  "tested_by_user_id"        TEXT,
  "tested_at"                TIMESTAMP(3),
  "test_notes"               TEXT,
  "supporting_evidence_id"   TEXT,
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assurance_samples_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "assurance_samples_org_engagement_result_idx" ON "assurance_samples"("organization_id", "engagement_id", "result");

DO $$ BEGIN
  ALTER TABLE "assurance_samples" ADD CONSTRAINT "assurance_samples_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "assurance_samples" ADD CONSTRAINT "assurance_samples_engagement_id_fkey"
    FOREIGN KEY ("engagement_id") REFERENCES "assurance_engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "assurance_samples" ADD CONSTRAINT "assurance_samples_emission_calculation_id_fkey"
    FOREIGN KEY ("emission_calculation_id") REFERENCES "emission_calculations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "assurance_samples" ADD CONSTRAINT "assurance_samples_activity_record_id_fkey"
    FOREIGN KEY ("activity_record_id") REFERENCES "activity_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "assurance_samples" ADD CONSTRAINT "assurance_samples_tested_by_user_id_fkey"
    FOREIGN KEY ("tested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Assurance findings ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "assurance_findings" (
  "id"                                TEXT NOT NULL,
  "organization_id"                   TEXT NOT NULL,
  "engagement_id"                     TEXT NOT NULL,
  "sample_id"                         TEXT,
  "severity"                          "FindingSeverity" NOT NULL,
  "status"                            "FindingStatus" NOT NULL DEFAULT 'open',
  "title"                             TEXT NOT NULL,
  "description"                       TEXT NOT NULL,
  "quantified_impact_co2e"            DECIMAL(18,4),
  "management_response"               TEXT,
  "management_responded_at"           TIMESTAMP(3),
  "management_responded_by_user_id"   TEXT,
  "resolved_at"                       TIMESTAMP(3),
  "raised_by_user_id"                 TEXT NOT NULL,
  "created_at"                        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assurance_findings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "assurance_findings_org_engagement_status_idx" ON "assurance_findings"("organization_id", "engagement_id", "status");
CREATE INDEX IF NOT EXISTS "assurance_findings_org_severity_idx" ON "assurance_findings"("organization_id", "severity");

DO $$ BEGIN
  ALTER TABLE "assurance_findings" ADD CONSTRAINT "assurance_findings_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "assurance_findings" ADD CONSTRAINT "assurance_findings_engagement_id_fkey"
    FOREIGN KEY ("engagement_id") REFERENCES "assurance_engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "assurance_findings" ADD CONSTRAINT "assurance_findings_sample_id_fkey"
    FOREIGN KEY ("sample_id") REFERENCES "assurance_samples"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "assurance_findings" ADD CONSTRAINT "assurance_findings_raised_by_user_id_fkey"
    FOREIGN KEY ("raised_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "assurance_findings" ADD CONSTRAINT "assurance_findings_management_responded_by_user_id_fkey"
    FOREIGN KEY ("management_responded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Framework datapoints (shared reference data) ───────────────────────────

CREATE TABLE IF NOT EXISTS "framework_datapoints" (
  "id"           TEXT NOT NULL,
  "framework"    "SupportedFramework" NOT NULL,
  "code"         TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "description"  TEXT NOT NULL,
  "category"     TEXT,
  "resolver_key" TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "framework_datapoints_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "framework_datapoints_framework_code_key" ON "framework_datapoints"("framework", "code");
CREATE INDEX IF NOT EXISTS "framework_datapoints_framework_idx" ON "framework_datapoints"("framework");

-- ─── Organization datapoint statuses (manual overrides / narrative evidence) ─

CREATE TABLE IF NOT EXISTS "organization_datapoint_statuses" (
  "id"                  TEXT NOT NULL,
  "organization_id"     TEXT NOT NULL,
  "datapoint_id"        TEXT NOT NULL,
  "status"              "DatapointStatus" NOT NULL,
  "evidence_summary"    TEXT,
  "evidence_file_id"    TEXT,
  "recorded_by_user_id" TEXT NOT NULL,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_datapoint_statuses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_datapoint_statuses_org_datapoint_key" ON "organization_datapoint_statuses"("organization_id", "datapoint_id");
CREATE INDEX IF NOT EXISTS "organization_datapoint_statuses_org_idx" ON "organization_datapoint_statuses"("organization_id");

DO $$ BEGIN
  ALTER TABLE "organization_datapoint_statuses" ADD CONSTRAINT "organization_datapoint_statuses_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "organization_datapoint_statuses" ADD CONSTRAINT "organization_datapoint_statuses_datapoint_id_fkey"
    FOREIGN KEY ("datapoint_id") REFERENCES "framework_datapoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "organization_datapoint_statuses" ADD CONSTRAINT "organization_datapoint_statuses_recorded_by_user_id_fkey"
    FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
