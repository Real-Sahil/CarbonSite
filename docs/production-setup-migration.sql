-- ============================================================
-- CarbonSite: Production Database Migration Script
-- Run this in the Neon SQL editor (console.neon.tech → SQL Editor)
-- SAFE TO RUN MULTIPLE TIMES — every statement is idempotent.
-- ============================================================

-- ─── MIGRATION: 20260614120000_device_tokens ─────────────────────────────────

CREATE TABLE IF NOT EXISTS "device_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "device_tokens_token_key" ON "device_tokens"("token");
CREATE INDEX IF NOT EXISTS "device_tokens_user_id_idx" ON "device_tokens"("user_id");

DO $$ BEGIN
  ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── MIGRATION: 20260614150000_add_missing_tables ────────────────────────────

-- Extend org_role enum
ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'sustainability_director';
ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'sustainability_manager';
ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'operations_manager';
ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'contract_manager';
ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'project_manager';
ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'site_manager';
ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'supervisor';
ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'employee';
ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'client_viewer';

-- Extend report_type enum
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'secr';
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'ppn_06_21';
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'nhs_evergreen';
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'breeam_evidence';
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'national_toms';
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'csrd_esrs_e1';
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'contract_carbon';

-- New enums
DO $$ BEGIN
  CREATE TYPE "platform_role" AS ENUM ('platform_owner', 'platform_support', 'platform_analyst');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "contract_status" AS ENUM ('active', 'completed', 'suspended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "project_status" AS ENUM ('active', 'completed', 'on_hold', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "document_type" AS ENUM (
    'waste_transfer_note', 'waste_collection_ticket', 'delivery_note',
    'goods_received_note', 'supplier_invoice', 'purchase_order', 'fuel_receipt',
    'mileage_log', 'utility_bill', 'recycling_certificate', 'training_record',
    'volunteering_record', 'apprenticeship_contract', 'employment_record',
    'hazardous_waste_record', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- platform_memberships
CREATE TABLE IF NOT EXISTS "platform_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "platform_role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platform_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_memberships_user_id_key" ON "platform_memberships"("user_id");

DO $$ BEGIN
  ALTER TABLE "platform_memberships" ADD CONSTRAINT "platform_memberships_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- tenant_branding
CREATE TABLE IF NOT EXISTS "tenant_branding" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "custom_domain" TEXT,
    "primary_hex" TEXT NOT NULL DEFAULT '#0f4c8a',
    "accent_hex" TEXT NOT NULL DEFAULT '#e8f0fe',
    "logo_storage_key" TEXT,
    "favicon_storage_key" TEXT,
    "report_header_logo_key" TEXT,
    "email_from_name" TEXT,
    "email_from_domain" TEXT,
    "font_family" TEXT NOT NULL DEFAULT 'Inter',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenant_branding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_branding_organization_id_key" ON "tenant_branding"("organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_branding_subdomain_key" ON "tenant_branding"("subdomain");

DO $$ BEGIN
  ALTER TABLE "tenant_branding" ADD CONSTRAINT "tenant_branding_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- contracts
CREATE TABLE IF NOT EXISTS "contracts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "business_unit_id" TEXT,
    "name" TEXT NOT NULL,
    "client_name" TEXT,
    "contract_reference" TEXT,
    "contract_value" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "start_date" DATE,
    "end_date" DATE,
    "ppn0621_required" BOOLEAN NOT NULL DEFAULT false,
    "nhs_evergreen_required" BOOLEAN NOT NULL DEFAULT false,
    "breeam_required" BOOLEAN NOT NULL DEFAULT false,
    "status" "contract_status" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "contracts_organization_id_status_idx" ON "contracts"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "contracts_organization_id_business_unit_id_idx" ON "contracts"("organization_id", "business_unit_id");

DO $$ BEGIN
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_business_unit_id_fkey"
    FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- projects
CREATE TABLE IF NOT EXISTS "projects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "project_code" TEXT,
    "description" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "status" "project_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "projects_organization_id_contract_id_idx" ON "projects"("organization_id", "contract_id");

DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- sites
CREATE TABLE IF NOT EXISTS "sites" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "site_code" TEXT,
    "postcode" TEXT,
    "address_line1" TEXT,
    "city" TEXT,
    "country" TEXT DEFAULT 'GB',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sites_organization_id_project_id_idx" ON "sites"("organization_id", "project_id");

DO $$ BEGIN
  ALTER TABLE "sites" ADD CONSTRAINT "sites_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "sites" ADD CONSTRAINT "sites_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- social_value_themes
CREATE TABLE IF NOT EXISTS "social_value_themes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "social_value_themes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "social_value_themes_code_key" ON "social_value_themes"("code");

-- social_value_measures
CREATE TABLE IF NOT EXISTS "social_value_measures" (
    "id" TEXT NOT NULL,
    "theme_id" TEXT NOT NULL,
    "toms_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "value_per_unit" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "social_value_measures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "social_value_measures_toms_code_key" ON "social_value_measures"("toms_code");

DO $$ BEGIN
  ALTER TABLE "social_value_measures" ADD CONSTRAINT "social_value_measures_theme_id_fkey"
    FOREIGN KEY ("theme_id") REFERENCES "social_value_themes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- social_value_records
CREATE TABLE IF NOT EXISTS "social_value_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "measure_id" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "value_pounds" DECIMAL(18,2) NOT NULL,
    "evidence_file_id" TEXT,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "social_value_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "social_value_records_organization_id_contract_id_reporting_period_id_idx"
    ON "social_value_records"("organization_id", "contract_id", "reporting_period_id");

DO $$ BEGIN
  ALTER TABLE "social_value_records" ADD CONSTRAINT "social_value_records_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "social_value_records" ADD CONSTRAINT "social_value_records_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "social_value_records" ADD CONSTRAINT "social_value_records_reporting_period_id_fkey"
    FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "social_value_records" ADD CONSTRAINT "social_value_records_measure_id_fkey"
    FOREIGN KEY ("measure_id") REFERENCES "social_value_measures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "social_value_records" ADD CONSTRAINT "social_value_records_evidence_file_id_fkey"
    FOREIGN KEY ("evidence_file_id") REFERENCES "evidence_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "social_value_records" ADD CONSTRAINT "social_value_records_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- social_value_targets
CREATE TABLE IF NOT EXISTS "social_value_targets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "target_pounds" DECIMAL(18,2) NOT NULL,
    "baseline_pounds" DECIMAL(18,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "social_value_targets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "social_value_targets_organization_id_contract_id_reporting_period_id_key"
    ON "social_value_targets"("organization_id", "contract_id", "reporting_period_id");

DO $$ BEGIN
  ALTER TABLE "social_value_targets" ADD CONSTRAINT "social_value_targets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "social_value_targets" ADD CONSTRAINT "social_value_targets_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "social_value_targets" ADD CONSTRAINT "social_value_targets_reporting_period_id_fkey"
    FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- evidence_classifications
CREATE TABLE IF NOT EXISTS "evidence_classifications" (
    "id" TEXT NOT NULL,
    "evidence_file_id" TEXT NOT NULL,
    "document_type" "document_type" NOT NULL,
    "confidence_score" INTEGER NOT NULL,
    "extracted_fields" JSONB NOT NULL,
    "model_version" TEXT NOT NULL,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "certified" BOOLEAN NOT NULL DEFAULT FALSE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidence_classifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "evidence_classifications_evidence_file_id_idx" ON "evidence_classifications"("evidence_file_id");

DO $$ BEGIN
  ALTER TABLE "evidence_classifications" ADD CONSTRAINT "evidence_classifications_evidence_file_id_fkey"
    FOREIGN KEY ("evidence_file_id") REFERENCES "evidence_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "evidence_classifications" ADD CONSTRAINT "evidence_classifications_reviewed_by_user_id_fkey"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ocr_corrections
CREATE TABLE IF NOT EXISTS "ocr_corrections" (
    "id" TEXT NOT NULL,
    "evidence_file_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "original_value" TEXT,
    "corrected_value" TEXT NOT NULL,
    "corrected_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ocr_corrections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ocr_corrections_evidence_file_id_idx" ON "ocr_corrections"("evidence_file_id");

DO $$ BEGIN
  ALTER TABLE "ocr_corrections" ADD CONSTRAINT "ocr_corrections_evidence_file_id_fkey"
    FOREIGN KEY ("evidence_file_id") REFERENCES "evidence_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ocr_corrections" ADD CONSTRAINT "ocr_corrections_corrected_by_user_id_fkey"
    FOREIGN KEY ("corrected_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- New columns on activity_records
ALTER TABLE "activity_records" ADD COLUMN IF NOT EXISTS "site_id" TEXT;
ALTER TABLE "activity_records" ADD COLUMN IF NOT EXISTS "contract_id" TEXT;
CREATE INDEX IF NOT EXISTS "activity_records_organization_id_site_id_idx" ON "activity_records"("organization_id", "site_id");
CREATE INDEX IF NOT EXISTS "activity_records_organization_id_contract_id_idx" ON "activity_records"("organization_id", "contract_id");

DO $$ BEGIN
  ALTER TABLE "activity_records" ADD CONSTRAINT "activity_records_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- New columns on field_submissions
ALTER TABLE "field_submissions" ADD COLUMN IF NOT EXISTS "site_id" TEXT;
ALTER TABLE "field_submissions" ADD COLUMN IF NOT EXISTS "contract_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "field_submissions" ADD CONSTRAINT "field_submissions_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "field_submissions" ADD CONSTRAINT "field_submissions_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- New column on reports
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "contract_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "reports" ADD CONSTRAINT "reports_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── MIGRATION: 20260614170000_biogenic_and_snapshot_review ──────────────────

ALTER TABLE "activity_records" ADD COLUMN IF NOT EXISTS "biogenic_co2e" DECIMAL(18,8);
ALTER TABLE "emission_calculations" ADD COLUMN IF NOT EXISTS "biogenic_co2e" DECIMAL(18,8);

DO $$ BEGIN
  CREATE TYPE "snapshot_verification_status" AS ENUM ('pending_review', 'approved', 'changes_requested');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "published_snapshots" ADD COLUMN IF NOT EXISTS "verification_status" "snapshot_verification_status" DEFAULT 'pending_review';
ALTER TABLE "published_snapshots" ADD COLUMN IF NOT EXISTS "verified_by_user_id" TEXT;
ALTER TABLE "published_snapshots" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS "published_snapshots_verification_idx"
    ON "published_snapshots"("organization_id", "verification_status");

-- ─── MIGRATION: 20260614180000_gap_items_schema ──────────────────────────────

ALTER TABLE "field_submissions" ADD COLUMN IF NOT EXISTS "resubmitted_from_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "field_submissions" ADD CONSTRAINT "field_submissions_resubmitted_from_id_fkey"
    FOREIGN KEY ("resubmitted_from_id") REFERENCES "field_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "field_submissions_resubmitted_from_id_idx" ON "field_submissions"("resubmitted_from_id");

ALTER TABLE "emission_calculations" ADD COLUMN IF NOT EXISTS "selection_reason" TEXT;
ALTER TABLE "emission_calculations" ADD COLUMN IF NOT EXISTS "factor_value" DECIMAL(18,8);
ALTER TABLE "reduction_targets" ADD COLUMN IF NOT EXISTS "unit" TEXT;

-- ─── MIGRATION: 20260614190000_gap_items_2 ───────────────────────────────────

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE "import_batches" ADD COLUMN IF NOT EXISTS "last_processed_row_index" INTEGER;

CREATE INDEX IF NOT EXISTS "dashboard_aggregates_org_snapshot_scope_idx"
    ON "dashboard_aggregates"("organization_id", "snapshot_id", "scope");

ALTER TABLE "reduction_initiatives" ADD COLUMN IF NOT EXISTS "methodology" TEXT;

-- evidence_classifications.certified (included in CREATE TABLE above; guard for partial deploys)
ALTER TABLE "evidence_classifications" ADD COLUMN IF NOT EXISTS "certified" BOOLEAN NOT NULL DEFAULT FALSE;

-- webhooks
CREATE TABLE IF NOT EXISTS "webhooks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "webhooks_organization_id_idx" ON "webhooks"("organization_id");

DO $$ BEGIN
  ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- webhook_deliveries
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status_code" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "succeeded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "webhook_deliveries_webhook_id_created_at_idx"
    ON "webhook_deliveries"("webhook_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey"
    FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── MIGRATION: 20260615120000_field_worker_site_assignments ─────────────────

ALTER TABLE "invite_links" ADD COLUMN IF NOT EXISTS "site_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "field_worker_site_assignments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "assigned_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "field_worker_site_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "field_worker_site_assignments_organization_id_user_id_idx"
    ON "field_worker_site_assignments"("organization_id", "user_id");
CREATE INDEX IF NOT EXISTS "field_worker_site_assignments_organization_id_site_id_idx"
    ON "field_worker_site_assignments"("organization_id", "site_id");
CREATE UNIQUE INDEX IF NOT EXISTS "field_worker_site_assignments_organization_id_user_id_site_i_key"
    ON "field_worker_site_assignments"("organization_id", "user_id", "site_id");

DO $$ BEGIN
  ALTER TABLE "field_worker_site_assignments" ADD CONSTRAINT "field_worker_site_assignments_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "field_worker_site_assignments" ADD CONSTRAINT "field_worker_site_assignments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "field_worker_site_assignments" ADD CONSTRAINT "field_worker_site_assignments_assigned_by_user_id_fkey"
    FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "field_worker_site_assignments" ADD CONSTRAINT "field_worker_site_assignments_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── MIGRATION: 20260709120000_review_task_field_submission_type ─────────────

ALTER TYPE "review_task_type" ADD VALUE IF NOT EXISTS 'field_submission';

-- ─── MIGRATION: 20260717100000_calc_no_factor_and_run_error ─────────────────

ALTER TABLE "emission_calculations" ALTER COLUMN "emission_factor_id" DROP NOT NULL;
ALTER TABLE "calculation_runs" ADD COLUMN IF NOT EXISTS "error_message" TEXT;

-- ─── MIGRATION: 20260717110000_storage_objects ───────────────────────────────

CREATE TABLE IF NOT EXISTS "storage_objects" (
    "key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "storage_objects_pkey" PRIMARY KEY ("key")
);

-- ─── MIGRATION: 20260806100000_rate_limit_and_session_revocation ─────────────

CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
    "key" TEXT PRIMARY KEY,
    "count" INTEGER NOT NULL DEFAULT 0,
    "reset_at" TIMESTAMPTZ NOT NULL
);

ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMPTZ;

-- ─── MIGRATION: 20260808120000_cbam_ghg_cdp_report_types ────────────────────

ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'ghg_protocol';
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'cdp';
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'cbam';

ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "xml_storage_key" TEXT;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "xml_checksum" TEXT;

-- ─── MIGRATION: 20260808130000_embodied_carbon_multi_industry ────────────────

ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'ppn_006_crp';

-- embodied_materials
CREATE TABLE IF NOT EXISTS "embodied_materials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "gwp_a1_a3" DOUBLE PRECISION NOT NULL,
    "gwp_a4" DOUBLE PRECISION,
    "gwp_a5" DOUBLE PRECISION,
    "gwp_c1_c4" DOUBLE PRECISION,
    "gwp_d" DOUBLE PRECISION,
    "declared_unit" TEXT NOT NULL DEFAULT 'kg',
    "density" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'ICE v3.0',
    "source_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "embodied_materials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "embodied_materials_name_key" ON "embodied_materials"("name");

-- epd_records
CREATE TABLE IF NOT EXISTS "epd_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "material_id" TEXT,
    "product_name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "valid_from" TIMESTAMPTZ,
    "valid_until" TIMESTAMPTZ,
    "gwp_a1_a3" DOUBLE PRECISION NOT NULL,
    "gwp_a4" DOUBLE PRECISION,
    "gwp_a5" DOUBLE PRECISION,
    "gwp_c1_c4" DOUBLE PRECISION,
    "gwp_d" DOUBLE PRECISION,
    "declared_unit" TEXT NOT NULL DEFAULT 'kg',
    "storage_key" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "epd_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "epd_records_organization_id_idx" ON "epd_records"("organization_id");

DO $$ BEGIN
  ALTER TABLE "epd_records" ADD CONSTRAINT "epd_records_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "epd_records" ADD CONSTRAINT "epd_records_material_id_fkey"
    FOREIGN KEY ("material_id") REFERENCES "embodied_materials"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- embodied_carbon_records
CREATE TABLE IF NOT EXISTS "embodied_carbon_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT,
    "reporting_period_id" TEXT,
    "material_id" TEXT,
    "epd_id" TEXT,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "gwp_a1_a3_used" DOUBLE PRECISION NOT NULL,
    "gwp_a4_used" DOUBLE PRECISION,
    "total_kg_co2e" DOUBLE PRECISION NOT NULL,
    "lifecycle_stages" TEXT[] NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "field_submission_id" TEXT,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "embodied_carbon_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "embodied_carbon_records_org_project_idx" ON "embodied_carbon_records"("organization_id", "project_id");
CREATE INDEX IF NOT EXISTS "embodied_carbon_records_org_period_idx" ON "embodied_carbon_records"("organization_id", "reporting_period_id");

DO $$ BEGIN
  ALTER TABLE "embodied_carbon_records" ADD CONSTRAINT "embodied_carbon_records_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "embodied_carbon_records" ADD CONSTRAINT "embodied_carbon_records_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "embodied_carbon_records" ADD CONSTRAINT "embodied_carbon_records_reporting_period_id_fkey"
    FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "embodied_carbon_records" ADD CONSTRAINT "embodied_carbon_records_material_id_fkey"
    FOREIGN KEY ("material_id") REFERENCES "embodied_materials"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "embodied_carbon_records" ADD CONSTRAINT "embodied_carbon_records_epd_id_fkey"
    FOREIGN KEY ("epd_id") REFERENCES "epd_records"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "embodied_carbon_records" ADD CONSTRAINT "embodied_carbon_records_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── MIGRATION: 20260808_add_api_keys ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_key_hash_key" ON "api_keys"("key_hash");
CREATE INDEX IF NOT EXISTS "api_keys_organization_id_idx" ON "api_keys"("organization_id");

DO $$ BEGIN
  ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── MIGRATION: 20260808_add_billing ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "billing_subscriptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'trial',
    "status" TEXT NOT NULL DEFAULT 'active',
    "trial_ends_at" TIMESTAMP(3),
    "current_period_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_subscriptions_organization_id_key" ON "billing_subscriptions"("organization_id");

DO $$ BEGIN
  ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "usage_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "usage_events_organization_id_event_type_recorded_at_idx"
    ON "usage_events"("organization_id", "event_type", "recorded_at");

DO $$ BEGIN
  ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── MIGRATION: 20260808_add_offsets_compliance ───────────────────────────────

CREATE TABLE IF NOT EXISTS "carbon_offsets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "project_name" TEXT NOT NULL,
    "project_type" TEXT NOT NULL,
    "standard" TEXT NOT NULL DEFAULT 'VCS',
    "vintage" INTEGER NOT NULL,
    "quantity_tonnes" DECIMAL(12,4) NOT NULL,
    "price_per_tonne" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "purchased_at" TIMESTAMP(3) NOT NULL,
    "serial_numbers" TEXT,
    "retirement_ref" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "carbon_offsets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "carbon_offsets_organization_id_purchased_at_idx"
    ON "carbon_offsets"("organization_id", "purchased_at");

DO $$ BEGIN
  ALTER TABLE "carbon_offsets" ADD CONSTRAINT "carbon_offsets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "compliance_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "reporting_year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "due_date" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "compliance_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "compliance_records_organization_id_framework_reporting_year_key"
    ON "compliance_records"("organization_id", "framework", "reporting_year");
CREATE INDEX IF NOT EXISTS "compliance_records_organization_id_reporting_year_idx"
    ON "compliance_records"("organization_id", "reporting_year");

DO $$ BEGIN
  ALTER TABLE "compliance_records" ADD CONSTRAINT "compliance_records_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── MIGRATION: 20260808_phase6 ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "carbon_budgets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "total_budget_tco2e" DECIMAL(18,4) NOT NULL,
    "floor_area_m2" DECIMAL(12,2),
    "contract_value_gbp" DECIMAL(18,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "carbon_budgets_project_id_key" ON "carbon_budgets"("project_id");
CREATE INDEX IF NOT EXISTS "carbon_budgets_organization_id_idx" ON "carbon_budgets"("organization_id");

DO $$ BEGIN
  ALTER TABLE "carbon_budgets" ADD CONSTRAINT "carbon_budgets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "carbon_budgets" ADD CONSTRAINT "carbon_budgets_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "carbon_budget_phases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budget_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "budget_tco2e" DECIMAL(18,4) NOT NULL,
    "actual_tco2e" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "carbon_budget_phases_budget_id_sort_order_idx"
    ON "carbon_budget_phases"("budget_id", "sort_order");

DO $$ BEGIN
  ALTER TABLE "carbon_budget_phases" ADD CONSTRAINT "carbon_budget_phases_budget_id_fkey"
    FOREIGN KEY ("budget_id") REFERENCES "carbon_budgets"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "waste_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT,
    "waste_type" TEXT NOT NULL,
    "disposal_route" TEXT NOT NULL,
    "weight_tonnes" DECIMAL(12,4) NOT NULL,
    "co2e_tonnes" DECIMAL(12,6),
    "ewc_code" TEXT,
    "carrier_name" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "waste_records_organization_id_recorded_at_idx"
    ON "waste_records"("organization_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "waste_records_organization_id_project_id_idx"
    ON "waste_records"("organization_id", "project_id");

DO $$ BEGIN
  ALTER TABLE "waste_records" ADD CONSTRAINT "waste_records_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "waste_records" ADD CONSTRAINT "waste_records_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "sbti_targets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "pathway" TEXT NOT NULL DEFAULT '1.5C',
    "base_year" INTEGER NOT NULL,
    "baseline_scope1_tco2e" DECIMAL(18,4) NOT NULL,
    "baseline_scope2_tco2e" DECIMAL(18,4) NOT NULL,
    "baseline_scope3_tco2e" DECIMAL(18,4),
    "near_term_year" INTEGER NOT NULL DEFAULT 2030,
    "near_term_reduction_pct" DECIMAL(5,2) NOT NULL,
    "net_zero_year" INTEGER NOT NULL DEFAULT 2050,
    "net_zero_reduction_pct" DECIMAL(5,2) NOT NULL DEFAULT 90,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "sbti_targets_organization_id_key" ON "sbti_targets"("organization_id");

DO $$ BEGIN
  ALTER TABLE "sbti_targets" ADD CONSTRAINT "sbti_targets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── ALL MIGRATIONS APPLIED ───────────────────────────────────────────────────
-- After running this script, run the seed script (production-seed.sql) to
-- populate emission categories, embodied materials, and TOMS social value data.
