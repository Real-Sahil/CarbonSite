-- Final index-only reconciliation pass (zero data risk — indexes carry no
-- data of their own). Drops indexes schema.prisma no longer declares,
-- creates the ones it does, matching the current n8n_workflows/n8n_executions
-- shape (rewired in 20260904000011) and a handful of other tables where an
-- index was renamed or added without a matching migration ever landing.

DROP INDEX IF EXISTS "n8n_executions_organization_id_idx";
DROP INDEX IF EXISTS "n8n_executions_status_idx";
DROP INDEX IF EXISTS "n8n_executions_workflow_id_idx";
DROP INDEX IF EXISTS "n8n_workflows_n8n_workflow_id_key";
DROP INDEX IF EXISTS "n8n_workflows_organization_id_idx";
DROP INDEX IF EXISTS "n8n_workflows_trigger_action_idx";
DROP INDEX IF EXISTS "activity_records_organization_id_data_origin_idx";
DROP INDEX IF EXISTS "epd_records_submitted_by_user_id_idx";
DROP INDEX IF EXISTS "field_submissions_resubmitted_from_id_idx";
DROP INDEX IF EXISTS "forecasts_organization_id_idx";
DROP INDEX IF EXISTS "organization_memberships_terminated_at_idx";
DROP INDEX IF EXISTS "project_role_assignments_assigned_by_user_id_idx";
DROP INDEX IF EXISTS "project_role_assignments_organization_id_idx";
DROP INDEX IF EXISTS "project_role_assignments_project_id_idx";
DROP INDEX IF EXISTS "users_two_factor_enabled_idx";

CREATE INDEX IF NOT EXISTS "n8n_executions_organization_id_workflow_id_status_idx" ON "n8n_executions"("organization_id", "workflow_id", "status");
CREATE INDEX IF NOT EXISTS "n8n_executions_organization_id_created_at_idx" ON "n8n_executions"("organization_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "n8n_workflows_organization_id_trigger_enabled_idx" ON "n8n_workflows"("organization_id", "trigger", "enabled");
CREATE INDEX IF NOT EXISTS "n8n_workflows_organization_id_created_at_idx" ON "n8n_workflows"("organization_id", "created_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "n8n_workflows_organization_id_n8n_workflow_id_key" ON "n8n_workflows"("organization_id", "n8n_workflow_id");
CREATE INDEX IF NOT EXISTS "organization_emission_factors_organization_id_scope_emissio_idx" ON "organization_emission_factors"("organization_id", "scope", "emission_category_id");
CREATE INDEX IF NOT EXISTS "supplier_performance_data_quality_score_idx" ON "supplier_performance"("data_quality_score" DESC);
CREATE INDEX IF NOT EXISTS "supplier_performance_submission_count_idx" ON "supplier_performance"("submission_count" DESC);

-- Known Prisma limitation: dbgenerated() default expressions are compared
-- as raw strings against how Postgres reformats them internally, so this
-- can keep showing as "drift" in future diffs even though it's applied
-- and correct. Not something fixable short of moving expiresAt off
-- dbgenerated() entirely.
ALTER TABLE "analytics_dashboard_cache" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '24 hours';
