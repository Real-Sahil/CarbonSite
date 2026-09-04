-- Reconciles the remaining schema.prisma <-> applied-migrations drift found
-- via `prisma migrate diff` after the earlier migration-repair pass. Every
-- change below was verified against production data first (row counts /
-- distinct values queried directly) — nothing here drops a column or adds
-- a NOT NULL constraint where real data existed that would be lost or
-- violated. Where a diff looked like a column rename but was actually just
-- a missing `@map()` in schema.prisma (Prisma defaults to the literal
-- camelCase field name when @map is absent), the fix went into
-- schema.prisma instead of here — renaming a live, populated column to
-- satisfy an authoring mistake would be pointless churn. See CausalInferenceRun,
-- Scope3Estimate, Scope3EstimationModel, and AssuranceSample.samplingMethod
-- in schema.prisma for those.

-- ============================================================================
-- Dead table: onboarding_progress. No Prisma model references it, no
-- application code queries it, and it is empty in production.
-- ============================================================================
DROP TABLE IF EXISTS "onboarding_progress";

-- ============================================================================
-- AssuranceStatus / SubcontractorSubmissionStatus were created under their
-- Prisma enum names instead of their @@map values (assurance_status /
-- subcontractor_submission_status) — the same PascalCase-vs-@@map bug found
-- repeatedly in the earlier repair pass, just in two enum-creating
-- migrations that hadn't been reached yet. Their source migrations
-- (20260825170000_add_snapshot_assurance_model,
-- 20260904000007_project_carbon) are fixed for future fresh installs;
-- this renames the type in place for environments where it was already
-- created under the wrong name, which also fixes every column already
-- using it (snapshot_assurances.status, subcontractor_carbon_submissions.status)
-- with no data rewrite.
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssuranceStatus') THEN
    ALTER TYPE "AssuranceStatus" RENAME TO "assurance_status";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubcontractorSubmissionStatus') THEN
    ALTER TYPE "SubcontractorSubmissionStatus" RENAME TO "subcontractor_submission_status";
  END IF;
END $$;

-- ============================================================================
-- New enum types schema.prisma declares but no column currently uses
-- (InvoiceAnomaly.anomalyType/severity and InvoiceReconciliation.matchStatus
-- are plain strings, not enum-typed — these three enums are additive only).
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE "invoice_anomaly_type" AS ENUM ('duplicate', 'qty_mismatch', 'date_inconsistency', 'price_spike', 'missing_grn', 'over_billing', 'currency_mismatch', 'unmatched_invoice');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "anomaly_severity" AS ENUM ('info', 'warning', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "invoice_reconciliation_status" AS ENUM ('matched', 'over_received', 'under_received', 'partial_match');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- activity_records: postcode_encrypted superseded by the encrypted-field
-- rework (delivery_postcode_original / postcode_extraction_source /
-- postcode_validation_status on field_submissions). 0 non-null rows.
-- ============================================================================
ALTER TABLE "activity_records" DROP COLUMN IF EXISTS "postcode_encrypted";

-- ============================================================================
-- airbyte_sync_connections: VARCHAR -> TEXT widening, no data impact.
-- ============================================================================
ALTER TABLE "airbyte_sync_connections"
  ALTER COLUMN "source_system" SET DATA TYPE TEXT,
  ALTER COLUMN "airbyte_connection_id" SET DATA TYPE TEXT,
  ALTER COLUMN "airbyte_source_id" SET DATA TYPE TEXT,
  ALTER COLUMN "airbyte_destination_id" SET DATA TYPE TEXT,
  ALTER COLUMN "last_sync_status" SET DATA TYPE TEXT,
  ALTER COLUMN "sync_frequency" SET DATA TYPE TEXT;

-- ============================================================================
-- api_data_sources: drop a default schema.prisma no longer declares.
-- ============================================================================
ALTER TABLE "api_data_sources" ALTER COLUMN "mapping_config" DROP DEFAULT;

-- ============================================================================
-- audit_events: VARCHAR -> TEXT widening.
-- ============================================================================
ALTER TABLE "audit_events"
  ALTER COLUMN "actor_id" SET DATA TYPE TEXT,
  ALTER COLUMN "action" SET DATA TYPE TEXT,
  ALTER COLUMN "table_name" SET DATA TYPE TEXT,
  ALTER COLUMN "record_id" SET DATA TYPE TEXT,
  ALTER COLUMN "ip_address" SET DATA TYPE TEXT;

-- ============================================================================
-- causal_inference_runs: VARCHAR -> TEXT and TIMESTAMP -> TIMESTAMP(3)
-- widening. Column names/@map fixed in schema.prisma, not here.
-- ============================================================================
ALTER TABLE "causal_inference_runs"
  ALTER COLUMN "treatment" SET DATA TYPE TEXT,
  ALTER COLUMN "outcome" SET DATA TYPE TEXT,
  ALTER COLUMN "method" SET DATA TYPE TEXT,
  ALTER COLUMN "model_id" SET DATA TYPE TEXT,
  ALTER COLUMN "status" SET DATA TYPE TEXT,
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "updated_at" DROP DEFAULT,
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- ============================================================================
-- dashboard_aggregates: scope2_method was left as free-text VARCHAR instead
-- of the scope2_method enum. Only 'location_based' exists in production
-- (verified), a valid enum value, so the cast is lossless.
-- ============================================================================
ALTER TABLE "dashboard_aggregates"
  ALTER COLUMN "scope2_method" SET DATA TYPE "scope2_method" USING "scope2_method"::text::"scope2_method";

-- ============================================================================
-- data_quality_checks: VARCHAR -> TEXT widening.
-- ============================================================================
ALTER TABLE "data_quality_checks"
  ALTER COLUMN "check_type" SET DATA TYPE TEXT,
  ALTER COLUMN "check_name" SET DATA TYPE TEXT;

-- ============================================================================
-- dbt_runs: drop a default schema.prisma no longer declares.
-- ============================================================================
ALTER TABLE "dbt_runs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- ============================================================================
-- dsar_requests: TIMESTAMP -> TIMESTAMP(3) widening.
-- ============================================================================
ALTER TABLE "dsar_requests"
  ALTER COLUMN "requested_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "due_by" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "completed_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- ============================================================================
-- embodied_carbon_records / embodied_materials: drop defaults schema.prisma
-- no longer declares; TIMESTAMP -> TIMESTAMP(3) widening.
-- ============================================================================
ALTER TABLE "embodied_carbon_records"
  ALTER COLUMN "lifecycle_stages" DROP DEFAULT,
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "updated_at" DROP DEFAULT,
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

ALTER TABLE "embodied_materials"
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "updated_at" DROP DEFAULT,
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- ============================================================================
-- emission_calculations: data_quality_score has 0 nulls in production —
-- safe to enforce NOT NULL.
-- ============================================================================
ALTER TABLE "emission_calculations" ALTER COLUMN "data_quality_score" SET NOT NULL;

-- ============================================================================
-- epd_records: drop a default; TIMESTAMP -> TIMESTAMP(3) widening.
-- ============================================================================
ALTER TABLE "epd_records"
  ALTER COLUMN "valid_from" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "valid_until" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "updated_at" DROP DEFAULT,
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- ============================================================================
-- facilities: project_id superseded by the project/facility hierarchy
-- rework. 0 non-null rows.
-- ============================================================================
ALTER TABLE "facilities" DROP COLUMN IF EXISTS "project_id";

-- ============================================================================
-- field_submissions: additive nullable postcode-extraction columns; DATE ->
-- TIMESTAMP(3) widening on the deadline-tracking columns.
-- ============================================================================
ALTER TABLE "field_submissions"
  ADD COLUMN IF NOT EXISTS "delivery_postcode_original" TEXT,
  ADD COLUMN IF NOT EXISTS "postcode_extraction_source" TEXT,
  ADD COLUMN IF NOT EXISTS "postcode_validation_status" TEXT,
  ALTER COLUMN "requested_by_deadline" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "submitted_at" SET DATA TYPE TIMESTAMP(3);

-- ============================================================================
-- integration_configs: VARCHAR -> TEXT widening; quickbooks_connected/
-- sage_connected have 0 nulls in production — safe to enforce NOT NULL;
-- TIMESTAMP -> TIMESTAMP(3) widening.
-- ============================================================================
ALTER TABLE "integration_configs"
  ALTER COLUMN "quickbooks_client_id" SET DATA TYPE TEXT,
  ALTER COLUMN "quickbooks_client_secret" SET DATA TYPE TEXT,
  ALTER COLUMN "quickbooks_connected" SET NOT NULL,
  ALTER COLUMN "quickbooks_connected_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "quickbooks_realm_id" SET DATA TYPE TEXT,
  ALTER COLUMN "quickbooks_token_expires_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "sage_client_id" SET DATA TYPE TEXT,
  ALTER COLUMN "sage_client_secret" SET DATA TYPE TEXT,
  ALTER COLUMN "sage_connected" SET NOT NULL,
  ALTER COLUMN "sage_connected_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "sage_tenant_id" SET DATA TYPE TEXT,
  ALTER COLUMN "sage_token_expires_at" SET DATA TYPE TIMESTAMP(3);

-- ============================================================================
-- integration_connections: external_tenant_id/metadata/token_type are
-- entirely null in production (verified) and no longer declared — dropped.
-- ============================================================================
ALTER TABLE "integration_connections"
  DROP COLUMN IF EXISTS "external_tenant_id",
  DROP COLUMN IF EXISTS "metadata",
  DROP COLUMN IF EXISTS "token_type";

-- ============================================================================
-- invoice_records: drop a default schema.prisma no longer declares.
-- ============================================================================
ALTER TABLE "invoice_records" ALTER COLUMN "updated_at" DROP DEFAULT;

-- ============================================================================
-- n8n_executions / n8n_workflows: both tables are empty in production
-- (verified) — the shape these two migrations created predates a later
-- schema.prisma redesign of the n8n integration (error/execution_time/
-- triggered_at/triggered_by -> error_message/duration/started_at/
-- trigger_event; execution_count/last_execution_status removed in favor of
-- last_failed_at/last_failure_reason/last_triggered_by, matching the
-- failure-tracking fields N8nWorkflow actually declares).
-- ============================================================================
ALTER TABLE "n8n_executions"
  DROP COLUMN IF EXISTS "error",
  DROP COLUMN IF EXISTS "execution_time",
  DROP COLUMN IF EXISTS "triggered_at",
  DROP COLUMN IF EXISTS "triggered_by",
  ADD COLUMN IF NOT EXISTS "duration" INTEGER,
  ADD COLUMN IF NOT EXISTS "error_message" TEXT,
  ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "trigger_event" TEXT NOT NULL DEFAULT 'unknown',
  ALTER COLUMN "status" SET DEFAULT 'running';

ALTER TABLE "n8n_executions" ALTER COLUMN "trigger_event" DROP DEFAULT;

ALTER TABLE "n8n_workflows"
  DROP COLUMN IF EXISTS "execution_count",
  DROP COLUMN IF EXISTS "last_execution_status",
  ADD COLUMN IF NOT EXISTS "last_failed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_failure_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "last_triggered_by" TEXT,
  ALTER COLUMN "updated_at" DROP DEFAULT;

-- ============================================================================
-- organization_memberships / supplier_tags: drop defaults schema.prisma no
-- longer declares.
-- ============================================================================
ALTER TABLE "organization_memberships" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "supplier_tags" ALTER COLUMN "updated_at" DROP DEFAULT;

-- ============================================================================
-- projects / sites: parent_project_id / parent_site_id superseded by the
-- project/facility hierarchy rework. 0 non-null rows in either.
-- ============================================================================
ALTER TABLE "projects" DROP COLUMN IF EXISTS "parent_project_id";
ALTER TABLE "sites" DROP COLUMN IF EXISTS "parent_site_id";

-- ============================================================================
-- published_snapshots: verification_status has 0 nulls in production —
-- safe to enforce NOT NULL; TIMESTAMP -> TIMESTAMP(3) widening.
-- ============================================================================
ALTER TABLE "published_snapshots"
  ALTER COLUMN "verification_status" SET NOT NULL,
  ALTER COLUMN "verified_at" SET DATA TYPE TIMESTAMP(3);

-- ============================================================================
-- rate_limit_buckets / sessions: TIMESTAMP -> TIMESTAMP(3) widening.
-- ============================================================================
ALTER TABLE "rate_limit_buckets" ALTER COLUMN "reset_at" SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "sessions" ALTER COLUMN "revoked_at" SET DATA TYPE TIMESTAMP(3);

-- ============================================================================
-- reporting_periods: VARCHAR -> TEXT widening.
-- ============================================================================
ALTER TABLE "reporting_periods" ALTER COLUMN "revenue_currency" SET DATA TYPE TEXT;

-- ============================================================================
-- scenario_drafts: VARCHAR -> TEXT widening; warnings/data_quality_score
-- have 0 nulls in production — safe to enforce NOT NULL.
-- ============================================================================
ALTER TABLE "scenario_drafts"
  ALTER COLUMN "original_unit" SET DATA TYPE TEXT,
  ALTER COLUMN "normalized_unit" SET DATA TYPE TEXT,
  ALTER COLUMN "selection_reason" SET DATA TYPE TEXT,
  ALTER COLUMN "warnings" SET NOT NULL,
  ALTER COLUMN "data_quality_score" SET NOT NULL,
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- ============================================================================
-- scenario_runs: TIMESTAMP -> TIMESTAMP(3) widening.
-- ============================================================================
ALTER TABLE "scenario_runs"
  ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- ============================================================================
-- supplier_category_assignments: emission_category_id is a brand-new
-- nullable column (no prior column to preserve).
-- ============================================================================
ALTER TABLE "supplier_category_assignments" ADD COLUMN IF NOT EXISTS "emission_category_id" TEXT;

DO $$
BEGIN
  ALTER TABLE "supplier_category_assignments" ADD CONSTRAINT "supplier_category_assignments_emission_category_id_fkey"
    FOREIGN KEY ("emission_category_id") REFERENCES "emission_categories"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- supplier_invites: TIMESTAMP -> TIMESTAMP(3) widening.
-- ============================================================================
ALTER TABLE "supplier_invites"
  ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "used_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- ============================================================================
-- supplier_performance: VARCHAR -> TEXT widening; drop a default.
-- ============================================================================
ALTER TABLE "supplier_performance"
  ALTER COLUMN "last_data_quality_trend" SET DATA TYPE TEXT,
  ALTER COLUMN "updated_at" DROP DEFAULT;

-- ============================================================================
-- supplier_performance_history: table is empty in production (verified) —
-- id/supplier_performance_id/organization_id widen from VARCHAR(191) to
-- TEXT (this repo's convention everywhere else), and recorded_at becomes
-- NOT NULL TIMESTAMP(3) instead of a nullable, unspecified-precision
-- TIMESTAMP.
-- ============================================================================
ALTER TABLE "supplier_performance_history"
  ALTER COLUMN "id" SET DATA TYPE TEXT,
  ALTER COLUMN "supplier_performance_id" SET DATA TYPE TEXT,
  ALTER COLUMN "organization_id" SET DATA TYPE TEXT,
  ALTER COLUMN "recorded_at" SET NOT NULL,
  ALTER COLUMN "recorded_at" SET DATA TYPE TIMESTAMP(3);

-- ============================================================================
-- sso_sessions: schema.prisma adds a default this migration never set.
-- ============================================================================
ALTER TABLE "sso_sessions" ALTER COLUMN "last_activity_at" SET DEFAULT CURRENT_TIMESTAMP;

-- ============================================================================
-- staged_external_data: VARCHAR -> TEXT widening.
-- ============================================================================
ALTER TABLE "staged_external_data"
  ALTER COLUMN "source_system" SET DATA TYPE TEXT,
  ALTER COLUMN "source_record_id" SET DATA TYPE TEXT,
  ALTER COLUMN "data_type" SET DATA TYPE TEXT;
