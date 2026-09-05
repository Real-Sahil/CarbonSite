-- Reconciles the 18 real ON DELETE behavior differences reported by
-- `prisma migrate diff` after the earlier snapshot-verification-fk
-- migration (this repo's schema.prisma has, over time, had its relation
-- onDelete/onUpdate attributes edited without a matching migration ever
-- being generated for each edit).
--
-- Each change below was checked against the actual application code before
-- being included here, not just the schema diff: for every FK, is there any
-- code path that deletes the parent row at all, and if so what does that
-- code currently assume happens to the child rows?
--
--   * Organization and User are never hard-deleted anywhere in this
--     codebase (organizations are never deleted; GDPR erasure tombstones
--     the User row in place rather than deleting it) - so the FKs below
--     touching organization_id / *_user_id columns are inert either way.
--     Included for correctness so the schema and database agree, not
--     because any current behavior depends on it.
--   * EPDRecord, EmbodiedMaterial, ReportingPeriod, EmissionFactor and
--     EmissionCategory are append-only/seeded and never deleted - same
--     reasoning.
--   * embodied_carbon_records_project_id_fkey is the one real bug fix here:
--     DELETE /orgs/{orgId}/contracts/{contractId}/projects/{projectId} is a
--     live endpoint with no cleanup step of its own. Every other FK
--     referencing projects(id) correctly cascades or SET NULLs; this one
--     had no rule at all (defaulting to blocking the delete). Right now,
--     deleting a project with any embodied carbon records fails with an
--     unhandled database error. This migration fixes that.
--   * scenario_drafts_activity_record_id_fkey was already effectively
--     RESTRICT in practice (NO ACTION behaves the same way here) - this
--     just makes it explicit, no behavior change.
--   * scenario_runs_calculation_run_id_fkey (CASCADE -> RESTRICT) is the one
--     that needed a code change first: the platform org-reset route
--     (app/api/platform/orgs/[orgId]/reset/route.ts) deletes CalculationRun
--     rows directly and was relying on this FK's CASCADE to silently take
--     any ScenarioRun/ScenarioDraft history with it, undocumented. That
--     route now explicitly deletes ScenarioRun rows (which cascades to
--     ScenarioDraft) before deleting CalculationRun, so tightening this FK
--     to RESTRICT no longer breaks it - it just makes the reset route fail
--     loudly instead of silently losing data if that ordering is ever
--     violated again.
--
-- Left out of this migration (still open, needs a look at real production
-- data before touching): 75 cosmetic index renames and ~42 other FKs where
-- only ON UPDATE NO ACTION -> CASCADE differs (meaningless here since every
-- PK in this schema is an immutable cuid).

ALTER TABLE "dsar_requests" DROP CONSTRAINT IF EXISTS "dsar_requests_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "dsar_requests" DROP CONSTRAINT IF EXISTS "dsar_requests_requested_by_user_id_fkey";
DO $$ BEGIN
  ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "dsar_requests" DROP CONSTRAINT IF EXISTS "dsar_requests_user_id_fkey";
DO $$ BEGIN
  ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "embodied_carbon_records" DROP CONSTRAINT IF EXISTS "embodied_carbon_records_created_by_user_id_fkey";
DO $$ BEGIN
  ALTER TABLE "embodied_carbon_records" ADD CONSTRAINT "embodied_carbon_records_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "embodied_carbon_records" DROP CONSTRAINT IF EXISTS "embodied_carbon_records_epd_id_fkey";
DO $$ BEGIN
  ALTER TABLE "embodied_carbon_records" ADD CONSTRAINT "embodied_carbon_records_epd_id_fkey" FOREIGN KEY ("epd_id") REFERENCES "epd_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "embodied_carbon_records" DROP CONSTRAINT IF EXISTS "embodied_carbon_records_material_id_fkey";
DO $$ BEGIN
  ALTER TABLE "embodied_carbon_records" ADD CONSTRAINT "embodied_carbon_records_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "embodied_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The real bug fix: see header comment.
ALTER TABLE "embodied_carbon_records" DROP CONSTRAINT IF EXISTS "embodied_carbon_records_project_id_fkey";
DO $$ BEGIN
  ALTER TABLE "embodied_carbon_records" ADD CONSTRAINT "embodied_carbon_records_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "embodied_carbon_records" DROP CONSTRAINT IF EXISTS "embodied_carbon_records_reporting_period_id_fkey";
DO $$ BEGIN
  ALTER TABLE "embodied_carbon_records" ADD CONSTRAINT "embodied_carbon_records_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "emission_calculations" DROP CONSTRAINT IF EXISTS "emission_calculations_emission_factor_id_fkey";
DO $$ BEGIN
  ALTER TABLE "emission_calculations" ADD CONSTRAINT "emission_calculations_emission_factor_id_fkey" FOREIGN KEY ("emission_factor_id") REFERENCES "emission_factors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "epd_records" DROP CONSTRAINT IF EXISTS "epd_records_material_id_fkey";
DO $$ BEGIN
  ALTER TABLE "epd_records" ADD CONSTRAINT "epd_records_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "embodied_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "epd_records" DROP CONSTRAINT IF EXISTS "epd_records_submitted_by_user_id_fkey";
DO $$ BEGIN
  ALTER TABLE "epd_records" ADD CONSTRAINT "epd_records_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "import_batches" DROP CONSTRAINT IF EXISTS "import_batches_created_by_user_id_fkey";
DO $$ BEGIN
  ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "scenario_drafts" DROP CONSTRAINT IF EXISTS "scenario_drafts_activity_record_id_fkey";
DO $$ BEGIN
  ALTER TABLE "scenario_drafts" ADD CONSTRAINT "scenario_drafts_activity_record_id_fkey" FOREIGN KEY ("activity_record_id") REFERENCES "activity_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Requires app/api/platform/orgs/[orgId]/reset/route.ts to delete
-- ScenarioRun before CalculationRun (shipped in the same change) - see
-- header comment.
ALTER TABLE "scenario_runs" DROP CONSTRAINT IF EXISTS "scenario_runs_calculation_run_id_fkey";
DO $$ BEGIN
  ALTER TABLE "scenario_runs" ADD CONSTRAINT "scenario_runs_calculation_run_id_fkey" FOREIGN KEY ("calculation_run_id") REFERENCES "calculation_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "scenario_runs" DROP CONSTRAINT IF EXISTS "scenario_runs_created_by_user_id_fkey";
DO $$ BEGIN
  ALTER TABLE "scenario_runs" ADD CONSTRAINT "scenario_runs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "scenario_runs" DROP CONSTRAINT IF EXISTS "scenario_runs_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "scenario_runs" ADD CONSTRAINT "scenario_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "supplier_category_assignments" DROP CONSTRAINT IF EXISTS "supplier_category_assignments_emission_category_id_fkey";
DO $$ BEGIN
  ALTER TABLE "supplier_category_assignments" ADD CONSTRAINT "supplier_category_assignments_emission_category_id_fkey" FOREIGN KEY ("emission_category_id") REFERENCES "emission_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "supplier_invites" DROP CONSTRAINT IF EXISTS "supplier_invites_created_by_user_id_fkey";
DO $$ BEGIN
  ALTER TABLE "supplier_invites" ADD CONSTRAINT "supplier_invites_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
