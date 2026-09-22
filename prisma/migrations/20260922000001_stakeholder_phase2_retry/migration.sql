-- Retry of 20260920000003_stakeholder_phase2 with corrected ordering.
-- The original failed because ALTER TABLE projects ADD COLUMN programme_id
-- referenced programmes(id) before that table was created in the same script.
-- This migration is idempotent: all DDL uses IF NOT EXISTS / IF NOT EXISTS guards.

-- ── OrgRole: add verifier ────────────────────────────────────────────────────
ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'verifier';

-- ── ReportType: add social_value, snapshot_export ───────────────────────────
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'social_value';
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'snapshot_export';

-- ── FieldSubmission: PPE, toolbox talk, training hours ───────────────────────
ALTER TABLE field_submissions
  ADD COLUMN IF NOT EXISTS ppe_verified               BOOLEAN,
  ADD COLUMN IF NOT EXISTS toolbox_talk_completed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS training_hours_logged       DECIMAL(8,2);

-- ── H&S enums ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "HsIncidentType" AS ENUM (
    'near_miss','first_aid','medical_treatment','lost_time_injury',
    'riddor_reportable','dangerous_occurrence','occupational_disease','fatality'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "HsBodyPart" AS ENUM (
    'head','neck','back','shoulder','arm','hand','finger',
    'leg','knee','foot','toe','multiple','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "HsIncidentStatus" AS ENUM (
    'reported','investigating','action_required','closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MethodStatementStatus" AS ENUM (
    'draft','issued','signed_off','superseded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ProgrammeStatus" AS ENUM (
    'active','on_hold','completed','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EnforcementNoticeType" AS ENUM (
    'improvement_notice','prohibition_notice','enforcement_notice',
    'stop_notice','remediation_notice','warning_letter','statutory_notice'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EnforcementNoticeStatus" AS ENUM (
    'open','appealed','complied','extended','withdrawn','overdue'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MaterialityAssessmentStatus" AS ENUM (
    'draft','stakeholder_review','approved','published'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MaterialityIroType" AS ENUM (
    'impact','risk','opportunity'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TnfdLeapPhase" AS ENUM (
    'locate','evaluate','assess','prepare'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TnfdDependencyType" AS ENUM (
    'provisioning','regulating','cultural'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Programme ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS programmes (
  id                        TEXT        NOT NULL PRIMARY KEY,
  organization_id           TEXT        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                      TEXT        NOT NULL,
  description               TEXT,
  status                    "ProgrammeStatus" NOT NULL DEFAULT 'active',
  client_name               TEXT,
  programme_manager_user_id TEXT        REFERENCES users(id) ON DELETE SET NULL,
  start_date                DATE,
  end_date                  DATE,
  budget_tco2e              DECIMAL(18,4),
  created_by_user_id        TEXT        NOT NULL REFERENCES users(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_programmes_org_status ON programmes (organization_id, status);

-- ── Project: programme FK (must come after programmes table) ─────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS programme_id TEXT REFERENCES programmes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_programme ON projects (programme_id) WHERE programme_id IS NOT NULL;

-- ── HS Incident Reports ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hs_incident_reports (
  id                    TEXT           NOT NULL PRIMARY KEY,
  organization_id       TEXT           NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reference             TEXT           NOT NULL,
  incident_type         "HsIncidentType" NOT NULL,
  status                "HsIncidentStatus" NOT NULL DEFAULT 'reported',
  occurred_at           TIMESTAMPTZ    NOT NULL,
  facility_id           TEXT           REFERENCES facilities(id) ON DELETE SET NULL,
  site_id               TEXT           REFERENCES sites(id) ON DELETE SET NULL,
  project_id            TEXT           REFERENCES projects(id) ON DELETE SET NULL,
  field_submission_id   TEXT,
  injured_party_name    TEXT,
  body_part_affected    "HsBodyPart",
  description           TEXT           NOT NULL,
  immediate_action      TEXT,
  root_cause            TEXT,
  ppe_worn              BOOLEAN        NOT NULL DEFAULT TRUE,
  toolbox_talk_evidence TEXT,
  method_statement_id   TEXT,
  lost_time_days        INTEGER        NOT NULL DEFAULT 0,
  riddor_reportable     BOOLEAN        NOT NULL DEFAULT FALSE,
  riddor_reference_no   TEXT,
  riddor_notified_at    TIMESTAMPTZ,
  witness_names         TEXT,
  reported_by_user_id   TEXT           REFERENCES users(id) ON DELETE SET NULL,
  owner_user_id         TEXT           REFERENCES users(id) ON DELETE SET NULL,
  closed_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ    NOT NULL DEFAULT now(),
  UNIQUE(organization_id, reference)
);

CREATE INDEX IF NOT EXISTS idx_hs_incidents_org_status   ON hs_incident_reports (organization_id, status, occurred_at);
CREATE INDEX IF NOT EXISTS idx_hs_incidents_org_type     ON hs_incident_reports (organization_id, incident_type);

-- ── Method Statements ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS method_statements (
  id                    TEXT        NOT NULL PRIMARY KEY,
  organization_id       TEXT        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id            TEXT        REFERENCES projects(id) ON DELETE SET NULL,
  site_id               TEXT        REFERENCES sites(id) ON DELETE SET NULL,
  title                 TEXT        NOT NULL,
  version               TEXT        NOT NULL DEFAULT '1.0',
  status                "MethodStatementStatus" NOT NULL DEFAULT 'draft',
  risk_assessment_text  TEXT,
  method_text           TEXT,
  ppe_required          TEXT,
  issued_at             DATE,
  expires_at            DATE,
  evidence_file_id      TEXT,
  created_by_user_id    TEXT        NOT NULL REFERENCES users(id),
  signed_off_by_user_id TEXT        REFERENCES users(id) ON DELETE SET NULL,
  signed_off_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_method_statements_org_status  ON method_statements (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_method_statements_org_project ON method_statements (organization_id, project_id);

-- ── Add method_statement_id FK to hs_incident_reports ────────────────────────
-- ADD CONSTRAINT does not support IF NOT EXISTS in Postgres; use DO block.
DO $$ BEGIN
  ALTER TABLE hs_incident_reports
    ADD CONSTRAINT fk_hs_incident_method_statement
    FOREIGN KEY (method_statement_id) REFERENCES method_statements(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Worker Sessions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worker_sessions (
  id               TEXT        NOT NULL PRIMARY KEY,
  organization_id  TEXT        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          TEXT        NOT NULL REFERENCES users(id),
  project_id       TEXT        REFERENCES projects(id) ON DELETE SET NULL,
  site_id          TEXT        REFERENCES sites(id) ON DELETE SET NULL,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at         TIMESTAMPTZ,
  last_ping_at     TIMESTAMPTZ,
  last_ping_lat    DECIMAL(10,7),
  last_ping_lng    DECIMAL(10,7),
  overdue_alert    BOOLEAN     NOT NULL DEFAULT FALSE,
  overdue_alert_at TIMESTAMPTZ,
  device_info      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_sessions_org_user ON worker_sessions (organization_id, user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_worker_sessions_overdue  ON worker_sessions (organization_id, overdue_alert);

-- ── Enforcement Notices ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enforcement_notices (
  id                   TEXT        NOT NULL PRIMARY KEY,
  organization_id      TEXT        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reference            TEXT        NOT NULL,
  issuing_body         TEXT        NOT NULL,
  notice_type          "EnforcementNoticeType" NOT NULL,
  status               "EnforcementNoticeStatus" NOT NULL DEFAULT 'open',
  issued_at            DATE        NOT NULL,
  compliance_deadline  DATE,
  complied_at          DATE,
  facility_id          TEXT        REFERENCES facilities(id) ON DELETE SET NULL,
  site_id              TEXT        REFERENCES sites(id) ON DELETE SET NULL,
  permit_id            TEXT        REFERENCES environmental_permits(id) ON DELETE SET NULL,
  subject              TEXT        NOT NULL,
  requirements         TEXT,
  appealed             BOOLEAN     NOT NULL DEFAULT FALSE,
  appeal_outcome       TEXT,
  regulator_contact    TEXT,
  evidence_file_id     TEXT,
  owner_user_id        TEXT        REFERENCES users(id) ON DELETE SET NULL,
  created_by_user_id   TEXT        NOT NULL REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, reference)
);

CREATE INDEX IF NOT EXISTS idx_enforcement_notices_org_status ON enforcement_notices (organization_id, status, compliance_deadline);
CREATE INDEX IF NOT EXISTS idx_enforcement_notices_permit     ON enforcement_notices (organization_id, permit_id);

-- ── Discharge Readings ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discharge_readings (
  id                   TEXT         NOT NULL PRIMARY KEY,
  organization_id      TEXT         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  permit_condition_id  TEXT         NOT NULL REFERENCES permit_conditions(id) ON DELETE CASCADE,
  reading_date         DATE         NOT NULL,
  parameter            TEXT         NOT NULL,
  unit                 TEXT         NOT NULL,
  limit_value          DECIMAL(18,6),
  actual_value         DECIMAL(18,6) NOT NULL,
  exceedance           BOOLEAN      NOT NULL DEFAULT FALSE,
  monitoring_method    TEXT,
  notes                TEXT,
  evidence_file_id     TEXT,
  created_by_user_id   TEXT         NOT NULL REFERENCES users(id),
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discharge_readings_condition  ON discharge_readings (organization_id, permit_condition_id, reading_date);
CREATE INDEX IF NOT EXISTS idx_discharge_readings_exceedance ON discharge_readings (organization_id, exceedance);

-- ── Supplier Profiles ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_profiles (
  id                           TEXT        NOT NULL PRIMARY KEY,
  organization_id              TEXT        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_email               TEXT        NOT NULL,
  supplier_name                TEXT,
  company_number               TEXT,
  living_wage_declared         BOOLEAN     NOT NULL DEFAULT FALSE,
  living_wage_declared_at      DATE,
  living_wage_expires_at       DATE,
  waste_carrier_registration   TEXT,
  waste_carrier_expires_at     DATE,
  iso14001_certified           BOOLEAN     NOT NULL DEFAULT FALSE,
  iso14001_expires_at          DATE,
  iso45001_certified           BOOLEAN     NOT NULL DEFAULT FALSE,
  iso45001_expires_at          DATE,
  modern_slavery_statement     BOOLEAN     NOT NULL DEFAULT FALSE,
  modern_slavery_statement_year INT,
  ssip_accreditation           TEXT,
  ssip_expires_at              DATE,
  notes                        TEXT,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, supplier_email)
);

CREATE INDEX IF NOT EXISTS idx_supplier_profiles_org_living_wage ON supplier_profiles (organization_id, living_wage_declared);
CREATE INDEX IF NOT EXISTS idx_supplier_profiles_org_carrier     ON supplier_profiles (organization_id, waste_carrier_expires_at);

-- ── Materiality Assessments ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS materiality_assessments (
  id                    TEXT        NOT NULL PRIMARY KEY,
  organization_id       TEXT        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reporting_period_id   TEXT        REFERENCES reporting_periods(id) ON DELETE SET NULL,
  name                  TEXT        NOT NULL,
  status                "MaterialityAssessmentStatus" NOT NULL DEFAULT 'draft',
  esrs_scope            TEXT,
  methodology_notes     TEXT,
  stakeholder_input     TEXT,
  approved_at           DATE,
  published_at          TIMESTAMPTZ,
  created_by_user_id    TEXT        NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_materiality_assessments_org_status ON materiality_assessments (organization_id, status);

CREATE TABLE IF NOT EXISTS materiality_topics (
  id                      TEXT       NOT NULL PRIMARY KEY,
  assessment_id           TEXT       NOT NULL REFERENCES materiality_assessments(id) ON DELETE CASCADE,
  organization_id         TEXT       NOT NULL,
  esrs_code               TEXT,
  topic_name              TEXT       NOT NULL,
  iro_type                "MaterialityIroType" NOT NULL,
  impact_score            INTEGER,
  financial_score         INTEGER,
  double_materiality_score INTEGER,
  is_material             BOOLEAN    NOT NULL DEFAULT FALSE,
  rationale               TEXT,
  owner_user_id           TEXT       REFERENCES users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_materiality_topics_assessment ON materiality_topics (assessment_id);
CREATE INDEX IF NOT EXISTS idx_materiality_topics_org_esrs   ON materiality_topics (organization_id, esrs_code);

-- ── TNFD Scenarios ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tnfd_scenarios (
  id                    TEXT        NOT NULL PRIMARY KEY,
  organization_id       TEXT        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,
  description           TEXT,
  gbf_target            TEXT,
  time_horizon          TEXT,
  sector_scope          TEXT,
  risk_rating           TEXT,
  locate_notes          TEXT,
  evaluate_notes        TEXT,
  assess_notes          TEXT,
  prepare_notes         TEXT,
  financial_impact_low  DECIMAL(18,2),
  financial_impact_high DECIMAL(18,2),
  created_by_user_id    TEXT        REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tnfd_scenarios_org ON tnfd_scenarios (organization_id, risk_rating);

-- ── Evidence Access Log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evidence_access_logs (
  id                   TEXT        NOT NULL PRIMARY KEY,
  organization_id      TEXT        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  evidence_file_id     TEXT        NOT NULL,
  accessed_by_user_id  TEXT,
  ip_address           TEXT,
  user_agent           TEXT,
  access_purpose       TEXT,
  storage_key          TEXT        NOT NULL,
  expiry_seconds       INTEGER,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_access_logs_file ON evidence_access_logs (organization_id, evidence_file_id, created_at);
CREATE INDEX IF NOT EXISTS idx_evidence_access_logs_user ON evidence_access_logs (organization_id, accessed_by_user_id, created_at);
