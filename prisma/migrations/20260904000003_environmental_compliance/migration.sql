-- Environmental management: permits and consents, legal register, incident and
-- non-conformance register with corrective actions, ISO 14001 aspects register.

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "PermitType" AS ENUM ('environmental_permit', 'discharge_consent', 'abstraction_licence', 'waste_carrier_licence', 'waste_management_licence', 'air_emissions_permit', 'radioactive_substances', 'species_licence', 'planning_condition', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PermitStatus" AS ENUM ('draft', 'applied', 'active', 'expired', 'suspended', 'revoked', 'surrendered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ComplianceStatus" AS ENUM ('compliant', 'at_risk', 'breach', 'not_assessed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IncidentType" AS ENUM ('spill', 'exceedance', 'unauthorised_release', 'complaint', 'near_miss', 'waste_misrouting', 'equipment_failure', 'ecological_damage', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IncidentSeverity" AS ENUM ('negligible', 'minor', 'moderate', 'major', 'severe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IncidentStatus" AS ENUM ('reported', 'investigating', 'contained', 'awaiting_action', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CorrectiveActionStatus" AS ENUM ('open', 'in_progress', 'awaiting_verification', 'verified', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ActionType" AS ENUM ('containment', 'corrective', 'preventive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AspectSignificance" AS ENUM ('low', 'medium', 'high', 'significant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Environmental permits ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "environmental_permits" (
  "id"                   TEXT NOT NULL,
  "organization_id"      TEXT NOT NULL,
  "facility_id"          TEXT,
  "site_id"              TEXT,
  "type"                 "PermitType" NOT NULL,
  "reference"            TEXT NOT NULL,
  "issuing_authority"    TEXT NOT NULL,
  "title"                TEXT NOT NULL,
  "description"          TEXT,
  "status"               "PermitStatus" NOT NULL DEFAULT 'active',
  "issued_on"            DATE,
  "effective_from"       DATE,
  "expires_on"           DATE,
  "renewal_notice_days"  INTEGER NOT NULL DEFAULT 90,
  "owner_user_id"        TEXT,
  "document_evidence_id" TEXT,
  "notes"                TEXT,
  "created_by_user_id"   TEXT NOT NULL,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "environmental_permits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "environmental_permits_organization_id_reference_key" ON "environmental_permits"("organization_id", "reference");
CREATE INDEX IF NOT EXISTS "environmental_permits_org_status_expiry_idx" ON "environmental_permits"("organization_id", "status", "expires_on");
CREATE INDEX IF NOT EXISTS "environmental_permits_org_facility_idx" ON "environmental_permits"("organization_id", "facility_id");

DO $$ BEGIN
  ALTER TABLE "environmental_permits" ADD CONSTRAINT "environmental_permits_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "environmental_permits" ADD CONSTRAINT "environmental_permits_facility_id_fkey"
    FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "environmental_permits" ADD CONSTRAINT "environmental_permits_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "environmental_permits" ADD CONSTRAINT "environmental_permits_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "environmental_permits" ADD CONSTRAINT "environmental_permits_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Permit conditions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "permit_conditions" (
  "id"                   TEXT NOT NULL,
  "organization_id"      TEXT NOT NULL,
  "permit_id"            TEXT NOT NULL,
  "reference"            TEXT NOT NULL,
  "description"          TEXT NOT NULL,
  "limit_value"          DECIMAL(18,6),
  "limit_unit"           TEXT,
  "monitoring_frequency" TEXT,
  "compliance_status"    "ComplianceStatus" NOT NULL DEFAULT 'not_assessed',
  "last_assessed_on"     DATE,
  "next_due_on"          DATE,
  "notes"                TEXT,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "permit_conditions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "permit_conditions_org_permit_idx" ON "permit_conditions"("organization_id", "permit_id");
CREATE INDEX IF NOT EXISTS "permit_conditions_org_status_due_idx" ON "permit_conditions"("organization_id", "compliance_status", "next_due_on");

DO $$ BEGIN
  ALTER TABLE "permit_conditions" ADD CONSTRAINT "permit_conditions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "permit_conditions" ADD CONSTRAINT "permit_conditions_permit_id_fkey"
    FOREIGN KEY ("permit_id") REFERENCES "environmental_permits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Legal register ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "legal_register_entries" (
  "id"                 TEXT NOT NULL,
  "organization_id"    TEXT NOT NULL,
  "title"              TEXT NOT NULL,
  "citation"           TEXT,
  "jurisdiction"       TEXT,
  "applicability"      TEXT NOT NULL,
  "obligation"         TEXT NOT NULL,
  "compliance_status"  "ComplianceStatus" NOT NULL DEFAULT 'not_assessed',
  "evidence_summary"   TEXT,
  "owner_user_id"      TEXT,
  "last_reviewed_on"   DATE,
  "next_review_on"     DATE,
  "reference_url"      TEXT,
  "notes"              TEXT,
  "created_by_user_id" TEXT NOT NULL,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "legal_register_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "legal_register_entries_org_status_idx" ON "legal_register_entries"("organization_id", "compliance_status");
CREATE INDEX IF NOT EXISTS "legal_register_entries_org_review_idx" ON "legal_register_entries"("organization_id", "next_review_on");

DO $$ BEGIN
  ALTER TABLE "legal_register_entries" ADD CONSTRAINT "legal_register_entries_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "legal_register_entries" ADD CONSTRAINT "legal_register_entries_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "legal_register_entries" ADD CONSTRAINT "legal_register_entries_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Environmental incidents ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "environmental_incidents" (
  "id"                    TEXT NOT NULL,
  "organization_id"       TEXT NOT NULL,
  "reference"             TEXT NOT NULL,
  "type"                  "IncidentType" NOT NULL,
  "severity"              "IncidentSeverity" NOT NULL,
  "status"                "IncidentStatus" NOT NULL DEFAULT 'reported',
  "occurred_at"           TIMESTAMP(3) NOT NULL,
  "discovered_at"         TIMESTAMP(3),
  "facility_id"           TEXT,
  "site_id"               TEXT,
  "project_id"            TEXT,
  "permit_id"             TEXT,
  "description"           TEXT NOT NULL,
  "immediate_action"      TEXT,
  "root_cause"            TEXT,
  "affected_medium"       TEXT,
  "estimated_quantity"    DECIMAL(18,6),
  "quantity_unit"         TEXT,
  "regulator_notifiable"  BOOLEAN NOT NULL DEFAULT false,
  "regulator_notified_at" TIMESTAMP(3),
  "regulator_reference"   TEXT,
  "reported_by_user_id"   TEXT,
  "owner_user_id"         TEXT,
  "closed_at"             TIMESTAMP(3),
  "created_by_user_id"    TEXT NOT NULL,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "environmental_incidents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "environmental_incidents_organization_id_reference_key" ON "environmental_incidents"("organization_id", "reference");
CREATE INDEX IF NOT EXISTS "environmental_incidents_org_status_occurred_idx" ON "environmental_incidents"("organization_id", "status", "occurred_at");
CREATE INDEX IF NOT EXISTS "environmental_incidents_org_severity_occurred_idx" ON "environmental_incidents"("organization_id", "severity", "occurred_at");
CREATE INDEX IF NOT EXISTS "environmental_incidents_org_facility_idx" ON "environmental_incidents"("organization_id", "facility_id");

DO $$ BEGIN
  ALTER TABLE "environmental_incidents" ADD CONSTRAINT "environmental_incidents_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "environmental_incidents" ADD CONSTRAINT "environmental_incidents_facility_id_fkey"
    FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "environmental_incidents" ADD CONSTRAINT "environmental_incidents_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "environmental_incidents" ADD CONSTRAINT "environmental_incidents_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "environmental_incidents" ADD CONSTRAINT "environmental_incidents_permit_id_fkey"
    FOREIGN KEY ("permit_id") REFERENCES "environmental_permits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "environmental_incidents" ADD CONSTRAINT "environmental_incidents_reported_by_user_id_fkey"
    FOREIGN KEY ("reported_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "environmental_incidents" ADD CONSTRAINT "environmental_incidents_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "environmental_incidents" ADD CONSTRAINT "environmental_incidents_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Corrective actions ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "corrective_actions" (
  "id"                   TEXT NOT NULL,
  "organization_id"      TEXT NOT NULL,
  "incident_id"          TEXT NOT NULL,
  "type"                 "ActionType" NOT NULL,
  "description"          TEXT NOT NULL,
  "status"               "CorrectiveActionStatus" NOT NULL DEFAULT 'open',
  "assigned_to_user_id"  TEXT,
  "due_on"               DATE,
  "completed_at"         TIMESTAMP(3),
  "verified_by_user_id"  TEXT,
  "verified_at"          TIMESTAMP(3),
  "verification_note"    TEXT,
  "created_by_user_id"   TEXT NOT NULL,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "corrective_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "corrective_actions_org_status_due_idx" ON "corrective_actions"("organization_id", "status", "due_on");
CREATE INDEX IF NOT EXISTS "corrective_actions_org_incident_idx" ON "corrective_actions"("organization_id", "incident_id");

DO $$ BEGIN
  ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_incident_id_fkey"
    FOREIGN KEY ("incident_id") REFERENCES "environmental_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_assigned_to_user_id_fkey"
    FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_verified_by_user_id_fkey"
    FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Environmental aspects ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "environmental_aspects" (
  "id"                  TEXT NOT NULL,
  "organization_id"     TEXT NOT NULL,
  "facility_id"         TEXT,
  "activity"            TEXT NOT NULL,
  "aspect"              TEXT NOT NULL,
  "impact"              TEXT NOT NULL,
  "operating_condition" TEXT NOT NULL DEFAULT 'normal',
  "severity_score"      INTEGER NOT NULL DEFAULT 1,
  "likelihood_score"    INTEGER NOT NULL DEFAULT 1,
  "legal_score"         INTEGER NOT NULL DEFAULT 1,
  "significance_score"  INTEGER NOT NULL DEFAULT 1,
  "significance"        "AspectSignificance" NOT NULL DEFAULT 'low',
  "existing_controls"   TEXT,
  "further_action"      TEXT,
  "owner_user_id"       TEXT,
  "last_reviewed_on"    DATE,
  "next_review_on"      DATE,
  "created_by_user_id"  TEXT NOT NULL,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "environmental_aspects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "environmental_aspects_org_significance_idx" ON "environmental_aspects"("organization_id", "significance");
CREATE INDEX IF NOT EXISTS "environmental_aspects_org_facility_idx" ON "environmental_aspects"("organization_id", "facility_id");

DO $$ BEGIN
  ALTER TABLE "environmental_aspects" ADD CONSTRAINT "environmental_aspects_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "environmental_aspects" ADD CONSTRAINT "environmental_aspects_facility_id_fkey"
    FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "environmental_aspects" ADD CONSTRAINT "environmental_aspects_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "environmental_aspects" ADD CONSTRAINT "environmental_aspects_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
