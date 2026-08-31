-- Migration: add_missing_tables
-- Adds all tables/enums/columns that exist in schema.prisma but were never migrated.
-- Safe to re-run: IF NOT EXISTS guards everywhere.

-- ─── 1. Extend existing enums ─────────────────────────────────────────────────

ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'sustainability_director';
ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'sustainability_manager';
ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'operations_manager';
ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'contract_manager';
ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'project_manager';
ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'site_manager';
ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'supervisor';
ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'employee';
ALTER TYPE "org_role" ADD VALUE IF NOT EXISTS 'client_viewer';

ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'secr';
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'ppn_06_21';
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'nhs_evergreen';
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'breeam_evidence';
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'national_toms';
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'csrd_esrs_e1';
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'contract_carbon';

-- ─── 2. New enums ─────────────────────────────────────────────────────────────

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
    'waste_transfer_note',
    'waste_collection_ticket',
    'delivery_note',
    'goods_received_note',
    'supplier_invoice',
    'purchase_order',
    'fuel_receipt',
    'mileage_log',
    'utility_bill',
    'recycling_certificate',
    'training_record',
    'volunteering_record',
    'apprenticeship_contract',
    'employment_record',
    'hazardous_waste_record',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 3. New tables (in dependency order) ─────────────────────────────────────

-- platform_memberships (depends on users)
CREATE TABLE IF NOT EXISTS "platform_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "platform_role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_memberships_user_id_key"
    ON "platform_memberships"("user_id");

DO $$
BEGIN
  ALTER TABLE "platform_memberships" ADD CONSTRAINT "platform_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- tenant_branding (depends on organizations)
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

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_branding_organization_id_key"
    ON "tenant_branding"("organization_id");

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_branding_subdomain_key"
    ON "tenant_branding"("subdomain");

DO $$
BEGIN
  ALTER TABLE "tenant_branding" ADD CONSTRAINT "tenant_branding_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- contracts (depends on organizations, business_units, users)
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

CREATE INDEX IF NOT EXISTS "contracts_organization_id_status_idx"
    ON "contracts"("organization_id", "status");

CREATE INDEX IF NOT EXISTS "contracts_organization_id_business_unit_id_idx"
    ON "contracts"("organization_id", "business_unit_id");

DO $$
BEGIN
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- projects (depends on contracts, organizations)
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

CREATE INDEX IF NOT EXISTS "projects_organization_id_contract_id_idx"
    ON "projects"("organization_id", "contract_id");

DO $$
BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- sites (depends on projects, organizations)
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

CREATE INDEX IF NOT EXISTS "sites_organization_id_project_id_idx"
    ON "sites"("organization_id", "project_id");

DO $$
BEGIN
  ALTER TABLE "sites" ADD CONSTRAINT "sites_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "sites" ADD CONSTRAINT "sites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- social_value_themes (no foreign keys)
CREATE TABLE IF NOT EXISTS "social_value_themes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "social_value_themes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "social_value_themes_code_key"
    ON "social_value_themes"("code");

-- social_value_measures (depends on social_value_themes)
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

CREATE UNIQUE INDEX IF NOT EXISTS "social_value_measures_toms_code_key"
    ON "social_value_measures"("toms_code");

DO $$
BEGIN
  ALTER TABLE "social_value_measures" ADD CONSTRAINT "social_value_measures_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "social_value_themes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- social_value_records (depends on organizations, contracts, reporting_periods, social_value_measures, evidence_files, users)
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

DO $$
BEGIN
  ALTER TABLE "social_value_records" ADD CONSTRAINT "social_value_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "social_value_records" ADD CONSTRAINT "social_value_records_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "social_value_records" ADD CONSTRAINT "social_value_records_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "social_value_records" ADD CONSTRAINT "social_value_records_measure_id_fkey" FOREIGN KEY ("measure_id") REFERENCES "social_value_measures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "social_value_records" ADD CONSTRAINT "social_value_records_evidence_file_id_fkey" FOREIGN KEY ("evidence_file_id") REFERENCES "evidence_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "social_value_records" ADD CONSTRAINT "social_value_records_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- social_value_targets (depends on organizations, contracts, reporting_periods)
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

DO $$
BEGIN
  ALTER TABLE "social_value_targets" ADD CONSTRAINT "social_value_targets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "social_value_targets" ADD CONSTRAINT "social_value_targets_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "social_value_targets" ADD CONSTRAINT "social_value_targets_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- evidence_classifications (depends on evidence_files, users)
CREATE TABLE IF NOT EXISTS "evidence_classifications" (
    "id" TEXT NOT NULL,
    "evidence_file_id" TEXT NOT NULL,
    "document_type" "document_type" NOT NULL,
    "confidence_score" INTEGER NOT NULL,
    "extracted_fields" JSONB NOT NULL,
    "model_version" TEXT NOT NULL,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_classifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "evidence_classifications_evidence_file_id_idx"
    ON "evidence_classifications"("evidence_file_id");

DO $$
BEGIN
  ALTER TABLE "evidence_classifications" ADD CONSTRAINT "evidence_classifications_evidence_file_id_fkey" FOREIGN KEY ("evidence_file_id") REFERENCES "evidence_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "evidence_classifications" ADD CONSTRAINT "evidence_classifications_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ocr_corrections (depends on evidence_files, users)
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

CREATE INDEX IF NOT EXISTS "ocr_corrections_evidence_file_id_idx"
    ON "ocr_corrections"("evidence_file_id");

DO $$
BEGIN
  ALTER TABLE "ocr_corrections" ADD CONSTRAINT "ocr_corrections_evidence_file_id_fkey" FOREIGN KEY ("evidence_file_id") REFERENCES "evidence_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ocr_corrections" ADD CONSTRAINT "ocr_corrections_corrected_by_user_id_fkey" FOREIGN KEY ("corrected_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 4. New columns on existing tables ───────────────────────────────────────

-- activity_records: site_id, contract_id
DO $$
BEGIN
  ALTER TABLE "activity_records"
  ADD COLUMN IF NOT EXISTS "site_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "activity_records"
  ADD COLUMN IF NOT EXISTS "contract_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Indexes for new activity_records columns
CREATE INDEX IF NOT EXISTS "activity_records_organization_id_site_id_idx"
    ON "activity_records"("organization_id", "site_id");

CREATE INDEX IF NOT EXISTS "activity_records_organization_id_contract_id_idx"
    ON "activity_records"("organization_id", "contract_id");

-- FK for site_id (explicit Prisma relation exists)
DO $$
BEGIN
  ALTER TABLE "activity_records" ADD CONSTRAINT "activity_records_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- field_submissions: site_id, contract_id
DO $$
BEGIN
  ALTER TABLE "field_submissions"
  ADD COLUMN IF NOT EXISTS "site_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "field_submissions"
  ADD COLUMN IF NOT EXISTS "contract_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- FK for site_id (explicit Prisma relation exists)
DO $$
BEGIN
  ALTER TABLE "field_submissions" ADD CONSTRAINT "field_submissions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FK for contract_id (explicit Prisma relation exists)
DO $$
BEGIN
  ALTER TABLE "field_submissions" ADD CONSTRAINT "field_submissions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- reports: contract_id
DO $$
BEGIN
  ALTER TABLE "reports"
  ADD COLUMN IF NOT EXISTS "contract_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- FK for contract_id (explicit Prisma relation exists)
DO $$
BEGIN
  ALTER TABLE "reports" ADD CONSTRAINT "reports_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
