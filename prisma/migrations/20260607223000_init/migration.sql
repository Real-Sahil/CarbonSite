-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "org_role" AS ENUM ('admin', 'editor', 'reviewer', 'viewer', 'auditor', 'field_worker');

-- CreateEnum
CREATE TYPE "reporting_period_type" AS ENUM ('month', 'quarter', 'year', 'custom');

-- CreateEnum
CREATE TYPE "reporting_period_status" AS ENUM ('draft', 'published', 'locked');

-- CreateEnum
CREATE TYPE "import_state" AS ENUM ('uploaded', 'parsing', 'mapped', 'validating', 'needs_attention', 'ready_to_commit', 'committed', 'failed');

-- CreateEnum
CREATE TYPE "staged_record_status" AS ENUM ('staged', 'excluded', 'ready');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('draft', 'in_review', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "evidence_status" AS ENUM ('missing', 'partial', 'complete');

-- CreateEnum
CREATE TYPE "scope2_method" AS ENUM ('location_based', 'market_based');

-- CreateEnum
CREATE TYPE "field_submission_status" AS ENUM ('pending', 'submitted', 'under_review', 'approved', 'rejected', 'needs_info');

-- CreateEnum
CREATE TYPE "field_document_type" AS ENUM ('waste_ticket', 'delivery_note', 'fuel_receipt', 'other');

-- CreateEnum
CREATE TYPE "calculation_run_status" AS ENUM ('queued', 'running', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "target_type" AS ENUM ('absolute', 'intensity');

-- CreateEnum
CREATE TYPE "initiative_status" AS ENUM ('planned', 'in_progress', 'complete', 'canceled');

-- CreateEnum
CREATE TYPE "report_type" AS ENUM ('inventory', 'monthly_snapshot', 'audit_package');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('queued', 'generating', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "review_task_type" AS ENUM ('import_batch', 'activity_record', 'report');

-- CreateEnum
CREATE TYPE "review_task_status" AS ENUM ('open', 'completed', 'blocked');

-- CreateEnum
CREATE TYPE "comment_target_type" AS ENUM ('import_batch', 'activity_record', 'report', 'initiative', 'field_submission');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "id_token" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "hq_country" TEXT,
    "reporting_currency" TEXT NOT NULL DEFAULT 'GBP',
    "default_units" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_memberships" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "org_role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_links" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" "org_role" NOT NULL DEFAULT 'field_worker',
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "used_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "region" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_units" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporting_periods" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "reporting_period_type" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "status" "reporting_period_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reporting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emission_categories" (
    "id" TEXT NOT NULL,
    "scope" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activity_type" TEXT,

    CONSTRAINT "emission_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "methodology_versions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gwp_version" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "methodology_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "state" "import_state" NOT NULL DEFAULT 'uploaded',
    "source_filename" TEXT NOT NULL,
    "source_storage_key" TEXT NOT NULL,
    "source_checksum" TEXT NOT NULL,
    "mapping" JSONB,
    "row_count" INTEGER,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "error_csv_storage_key" TEXT,
    "idempotency_key" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staged_activity_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "import_batch_id" TEXT NOT NULL,
    "row_number" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "validation_errors" JSONB NOT NULL DEFAULT '[]',
    "validation_warnings" JSONB NOT NULL DEFAULT '[]',
    "status" "staged_record_status" NOT NULL DEFAULT 'staged',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staged_activity_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "emission_category_id" TEXT NOT NULL,
    "activity_date" DATE,
    "start_date" DATE,
    "end_date" DATE,
    "amount" DECIMAL(18,6) NOT NULL,
    "unit" TEXT NOT NULL,
    "source_description" TEXT,
    "facility_id" TEXT,
    "business_unit_id" TEXT,
    "supplier_name" TEXT,
    "country" TEXT,
    "region" TEXT,
    "spend_amount" DECIMAL(18,2),
    "spend_currency" TEXT,
    "distance_amount" DECIMAL(18,4),
    "distance_unit" TEXT,
    "pickup_postcode" TEXT,
    "delivery_postcode" TEXT,
    "pickup_lat" DECIMAL(10,7),
    "pickup_lng" DECIMAL(10,7),
    "delivery_lat" DECIMAL(10,7),
    "delivery_lng" DECIMAL(10,7),
    "route_distance_id" TEXT,
    "route_distance_source" TEXT,
    "distance_override_reason" TEXT,
    "transport_mode" TEXT,
    "fuel_type" TEXT,
    "refrigerant_type" TEXT,
    "scope2_method" "scope2_method",
    "review_status" "review_status" NOT NULL DEFAULT 'draft',
    "evidence_status" "evidence_status" NOT NULL DEFAULT 'missing',
    "assumption_notes" TEXT,
    "import_batch_id" TEXT,
    "field_submission_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postcode_geocodes" (
    "id" TEXT NOT NULL,
    "normalized_postcode" TEXT NOT NULL,
    "display_postcode" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_place_id" TEXT,
    "quality" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "postcode_geocodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_distances" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "pickup_postcode" TEXT NOT NULL,
    "delivery_postcode" TEXT NOT NULL,
    "pickup_geocode_id" TEXT NOT NULL,
    "delivery_geocode_id" TEXT NOT NULL,
    "distance_km" DECIMAL(18,4) NOT NULL,
    "duration_seconds" INTEGER,
    "provider" TEXT NOT NULL,
    "provider_route_id" TEXT,
    "route_hash" TEXT NOT NULL,
    "calculation_method" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_distances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_files" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploaded_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_record_evidence" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "activity_record_id" TEXT NOT NULL,
    "evidence_file_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_record_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batch_evidence" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "import_batch_id" TEXT NOT NULL,
    "evidence_file_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batch_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_submissions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "emission_category_id" TEXT,
    "facility_id" TEXT,
    "submitted_by_user_id" TEXT NOT NULL,
    "document_type" "field_document_type" NOT NULL,
    "status" "field_submission_status" NOT NULL DEFAULT 'pending',
    "ocr_extracted_data" JSONB,
    "form_data" JSONB NOT NULL,
    "gps_lat" DECIMAL(10,7),
    "gps_lng" DECIMAL(10,7),
    "pickup_postcode" TEXT,
    "delivery_postcode" TEXT,
    "pickup_lat" DECIMAL(10,7),
    "pickup_lng" DECIMAL(10,7),
    "delivery_lat" DECIMAL(10,7),
    "delivery_lng" DECIMAL(10,7),
    "calculated_distance_km" DECIMAL(18,4),
    "distance_source" TEXT,
    "review_note" TEXT,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "activity_record_id" TEXT,
    "device_submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_submission_files" (
    "id" TEXT NOT NULL,
    "field_submission_id" TEXT NOT NULL,
    "evidence_file_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_submission_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factor_libraries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "license" TEXT NOT NULL,
    "source_url" TEXT,
    "published_at" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factor_libraries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emission_factors" (
    "id" TEXT NOT NULL,
    "factor_library_id" TEXT NOT NULL,
    "external_id" TEXT,
    "scope" INTEGER NOT NULL,
    "emission_category_id" TEXT,
    "activity_type" TEXT,
    "geography_country" TEXT,
    "geography_region" TEXT,
    "effective_start_date" DATE,
    "effective_end_date" DATE,
    "input_unit" TEXT NOT NULL,
    "co2" DECIMAL(18,8),
    "ch4" DECIMAL(18,8),
    "n2o" DECIMAL(18,8),
    "co2e" DECIMAL(18,8),
    "uncertainty_rating" TEXT,
    "usage_notes" TEXT,

    CONSTRAINT "emission_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "methodology_version_id" TEXT NOT NULL,
    "factor_library_id" TEXT NOT NULL,
    "triggered_by_user_id" TEXT NOT NULL,
    "status" "calculation_run_status" NOT NULL DEFAULT 'queued',
    "trigger_hash" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emission_calculations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "activity_record_id" TEXT NOT NULL,
    "calculation_run_id" TEXT NOT NULL,
    "emission_factor_id" TEXT NOT NULL,
    "factor_library_id" TEXT NOT NULL,
    "factor_library_version" TEXT NOT NULL,
    "methodology_version_name" TEXT NOT NULL,
    "original_amount" DECIMAL(18,6) NOT NULL,
    "original_unit" TEXT NOT NULL,
    "normalized_amount" DECIMAL(18,6) NOT NULL,
    "normalized_unit" TEXT NOT NULL,
    "co2" DECIMAL(18,8),
    "ch4" DECIMAL(18,8),
    "n2o" DECIMAL(18,8),
    "total_co2e" DECIMAL(18,8) NOT NULL,
    "formula" TEXT NOT NULL,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emission_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "published_snapshots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "calculation_run_id" TEXT NOT NULL,
    "published_by_user_id" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "published_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_aggregates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "snapshot_id" TEXT,
    "scope" INTEGER NOT NULL,
    "emission_category_id" TEXT,
    "facility_id" TEXT,
    "business_unit_id" TEXT,
    "total_co2e" DECIMAL(18,8) NOT NULL,
    "record_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reduction_targets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "baseline_period_id" TEXT NOT NULL,
    "target_period_id" TEXT NOT NULL,
    "target_type" "target_type" NOT NULL DEFAULT 'absolute',
    "reduction_amount" DECIMAL(18,4) NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reduction_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reduction_initiatives" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "status" "initiative_status" NOT NULL DEFAULT 'planned',
    "cost_amount" DECIMAL(18,2),
    "cost_currency" TEXT,
    "expected_impact_co2e" DECIMAL(18,4),
    "expected_start_date" DATE,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reduction_initiatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "type" "report_type" NOT NULL,
    "status" "report_status" NOT NULL DEFAULT 'queued',
    "version" INTEGER NOT NULL DEFAULT 1,
    "pdf_storage_key" TEXT,
    "csv_storage_key" TEXT,
    "pdf_checksum" TEXT,
    "csv_checksum" TEXT,
    "options" JSONB NOT NULL DEFAULT '{}',
    "request_hash" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_tasks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "review_task_type" NOT NULL,
    "target_id" TEXT NOT NULL,
    "assignee_user_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "status" "review_task_status" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "target_type" "comment_target_type" NOT NULL,
    "target_id" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "organization_memberships_organization_id_idx" ON "organization_memberships"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_memberships_organization_id_user_id_key" ON "organization_memberships"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "invite_links_token_key" ON "invite_links"("token");

-- CreateIndex
CREATE INDEX "invite_links_organization_id_idx" ON "invite_links"("organization_id");

-- CreateIndex
CREATE INDEX "facilities_organization_id_idx" ON "facilities"("organization_id");

-- CreateIndex
CREATE INDEX "business_units_organization_id_idx" ON "business_units"("organization_id");

-- CreateIndex
CREATE INDEX "reporting_periods_organization_id_start_date_end_date_idx" ON "reporting_periods"("organization_id", "start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "emission_categories_code_key" ON "emission_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "methodology_versions_name_key" ON "methodology_versions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "import_batches_idempotency_key_key" ON "import_batches"("idempotency_key");

-- CreateIndex
CREATE INDEX "import_batches_organization_id_reporting_period_id_state_idx" ON "import_batches"("organization_id", "reporting_period_id", "state");

-- CreateIndex
CREATE INDEX "import_batches_organization_id_source_checksum_idx" ON "import_batches"("organization_id", "source_checksum");

-- CreateIndex
CREATE INDEX "staged_activity_records_import_batch_id_status_idx" ON "staged_activity_records"("import_batch_id", "status");

-- CreateIndex
CREATE INDEX "activity_records_organization_id_reporting_period_id_emissi_idx" ON "activity_records"("organization_id", "reporting_period_id", "emission_category_id", "facility_id", "review_status", "created_at");

-- CreateIndex
CREATE INDEX "activity_records_organization_id_route_distance_id_idx" ON "activity_records"("organization_id", "route_distance_id");

-- CreateIndex
CREATE UNIQUE INDEX "postcode_geocodes_normalized_postcode_key" ON "postcode_geocodes"("normalized_postcode");

-- CreateIndex
CREATE UNIQUE INDEX "route_distances_route_hash_key" ON "route_distances"("route_hash");

-- CreateIndex
CREATE INDEX "route_distances_organization_id_pickup_postcode_delivery_po_idx" ON "route_distances"("organization_id", "pickup_postcode", "delivery_postcode");

-- CreateIndex
CREATE INDEX "evidence_files_organization_id_idx" ON "evidence_files"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_record_evidence_activity_record_id_evidence_file_i_key" ON "activity_record_evidence"("activity_record_id", "evidence_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "import_batch_evidence_import_batch_id_evidence_file_id_key" ON "import_batch_evidence"("import_batch_id", "evidence_file_id");

-- CreateIndex
CREATE INDEX "field_submissions_organization_id_status_created_at_idx" ON "field_submissions"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "field_submissions_organization_id_submitted_by_user_id_idx" ON "field_submissions"("organization_id", "submitted_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "field_submission_files_field_submission_id_evidence_file_id_key" ON "field_submission_files"("field_submission_id", "evidence_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "factor_libraries_name_version_key" ON "factor_libraries"("name", "version");

-- CreateIndex
CREATE INDEX "emission_factors_scope_emission_category_id_geography_count_idx" ON "emission_factors"("scope", "emission_category_id", "geography_country", "effective_start_date", "effective_end_date");

-- CreateIndex
CREATE UNIQUE INDEX "calculation_runs_trigger_hash_key" ON "calculation_runs"("trigger_hash");

-- CreateIndex
CREATE INDEX "calculation_runs_organization_id_reporting_period_id_status_idx" ON "calculation_runs"("organization_id", "reporting_period_id", "status");

-- CreateIndex
CREATE INDEX "emission_calculations_calculation_run_id_idx" ON "emission_calculations"("calculation_run_id");

-- CreateIndex
CREATE INDEX "emission_calculations_activity_record_id_idx" ON "emission_calculations"("activity_record_id");

-- CreateIndex
CREATE INDEX "published_snapshots_organization_id_reporting_period_id_idx" ON "published_snapshots"("organization_id", "reporting_period_id");

-- CreateIndex
CREATE INDEX "dashboard_aggregates_organization_id_reporting_period_id_sn_idx" ON "dashboard_aggregates"("organization_id", "reporting_period_id", "snapshot_id");

-- CreateIndex
CREATE INDEX "reduction_targets_organization_id_idx" ON "reduction_targets"("organization_id");

-- CreateIndex
CREATE INDEX "reduction_initiatives_organization_id_status_idx" ON "reduction_initiatives"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reports_request_hash_key" ON "reports"("request_hash");

-- CreateIndex
CREATE INDEX "reports_organization_id_reporting_period_id_status_idx" ON "reports"("organization_id", "reporting_period_id", "status");

-- CreateIndex
CREATE INDEX "review_tasks_organization_id_assignee_user_id_status_idx" ON "review_tasks"("organization_id", "assignee_user_id", "status");

-- CreateIndex
CREATE INDEX "comments_organization_id_target_type_target_id_idx" ON "comments"("organization_id", "target_type", "target_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_resource_type_resource_id_idx" ON "audit_logs"("organization_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_units" ADD CONSTRAINT "business_units_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporting_periods" ADD CONSTRAINT "reporting_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staged_activity_records" ADD CONSTRAINT "staged_activity_records_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_records" ADD CONSTRAINT "activity_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_records" ADD CONSTRAINT "activity_records_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_records" ADD CONSTRAINT "activity_records_emission_category_id_fkey" FOREIGN KEY ("emission_category_id") REFERENCES "emission_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_records" ADD CONSTRAINT "activity_records_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_records" ADD CONSTRAINT "activity_records_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_records" ADD CONSTRAINT "activity_records_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_records" ADD CONSTRAINT "activity_records_route_distance_id_fkey" FOREIGN KEY ("route_distance_id") REFERENCES "route_distances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_records" ADD CONSTRAINT "activity_records_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_distances" ADD CONSTRAINT "route_distances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_distances" ADD CONSTRAINT "route_distances_pickup_geocode_id_fkey" FOREIGN KEY ("pickup_geocode_id") REFERENCES "postcode_geocodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_distances" ADD CONSTRAINT "route_distances_delivery_geocode_id_fkey" FOREIGN KEY ("delivery_geocode_id") REFERENCES "postcode_geocodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_files" ADD CONSTRAINT "evidence_files_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_files" ADD CONSTRAINT "evidence_files_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_record_evidence" ADD CONSTRAINT "activity_record_evidence_activity_record_id_fkey" FOREIGN KEY ("activity_record_id") REFERENCES "activity_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_record_evidence" ADD CONSTRAINT "activity_record_evidence_evidence_file_id_fkey" FOREIGN KEY ("evidence_file_id") REFERENCES "evidence_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batch_evidence" ADD CONSTRAINT "import_batch_evidence_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batch_evidence" ADD CONSTRAINT "import_batch_evidence_evidence_file_id_fkey" FOREIGN KEY ("evidence_file_id") REFERENCES "evidence_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_submissions" ADD CONSTRAINT "field_submissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_submissions" ADD CONSTRAINT "field_submissions_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_submissions" ADD CONSTRAINT "field_submissions_emission_category_id_fkey" FOREIGN KEY ("emission_category_id") REFERENCES "emission_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_submissions" ADD CONSTRAINT "field_submissions_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_submissions" ADD CONSTRAINT "field_submissions_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_submission_files" ADD CONSTRAINT "field_submission_files_field_submission_id_fkey" FOREIGN KEY ("field_submission_id") REFERENCES "field_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_submission_files" ADD CONSTRAINT "field_submission_files_evidence_file_id_fkey" FOREIGN KEY ("evidence_file_id") REFERENCES "evidence_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_factors" ADD CONSTRAINT "emission_factors_factor_library_id_fkey" FOREIGN KEY ("factor_library_id") REFERENCES "factor_libraries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_factors" ADD CONSTRAINT "emission_factors_emission_category_id_fkey" FOREIGN KEY ("emission_category_id") REFERENCES "emission_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_runs" ADD CONSTRAINT "calculation_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_runs" ADD CONSTRAINT "calculation_runs_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_runs" ADD CONSTRAINT "calculation_runs_methodology_version_id_fkey" FOREIGN KEY ("methodology_version_id") REFERENCES "methodology_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_runs" ADD CONSTRAINT "calculation_runs_factor_library_id_fkey" FOREIGN KEY ("factor_library_id") REFERENCES "factor_libraries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_runs" ADD CONSTRAINT "calculation_runs_triggered_by_user_id_fkey" FOREIGN KEY ("triggered_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_calculations" ADD CONSTRAINT "emission_calculations_activity_record_id_fkey" FOREIGN KEY ("activity_record_id") REFERENCES "activity_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_calculations" ADD CONSTRAINT "emission_calculations_calculation_run_id_fkey" FOREIGN KEY ("calculation_run_id") REFERENCES "calculation_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_calculations" ADD CONSTRAINT "emission_calculations_emission_factor_id_fkey" FOREIGN KEY ("emission_factor_id") REFERENCES "emission_factors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emission_calculations" ADD CONSTRAINT "emission_calculations_methodology_version_name_fkey" FOREIGN KEY ("methodology_version_name") REFERENCES "methodology_versions"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_snapshots" ADD CONSTRAINT "published_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_snapshots" ADD CONSTRAINT "published_snapshots_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_snapshots" ADD CONSTRAINT "published_snapshots_calculation_run_id_fkey" FOREIGN KEY ("calculation_run_id") REFERENCES "calculation_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_snapshots" ADD CONSTRAINT "published_snapshots_published_by_user_id_fkey" FOREIGN KEY ("published_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_aggregates" ADD CONSTRAINT "dashboard_aggregates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_aggregates" ADD CONSTRAINT "dashboard_aggregates_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_aggregates" ADD CONSTRAINT "dashboard_aggregates_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "published_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_aggregates" ADD CONSTRAINT "dashboard_aggregates_emission_category_id_fkey" FOREIGN KEY ("emission_category_id") REFERENCES "emission_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_aggregates" ADD CONSTRAINT "dashboard_aggregates_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_aggregates" ADD CONSTRAINT "dashboard_aggregates_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reduction_targets" ADD CONSTRAINT "reduction_targets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reduction_targets" ADD CONSTRAINT "reduction_targets_baseline_period_id_fkey" FOREIGN KEY ("baseline_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reduction_targets" ADD CONSTRAINT "reduction_targets_target_period_id_fkey" FOREIGN KEY ("target_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reduction_targets" ADD CONSTRAINT "reduction_targets_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reduction_initiatives" ADD CONSTRAINT "reduction_initiatives_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reduction_initiatives" ADD CONSTRAINT "reduction_initiatives_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reduction_initiatives" ADD CONSTRAINT "reduction_initiatives_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "published_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_tasks" ADD CONSTRAINT "review_tasks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;