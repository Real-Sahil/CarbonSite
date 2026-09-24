-- Reconcile the database with schema.prisma (the drift CI tolerated as a
-- baseline). Generated with:
--   prisma migrate diff --from-url <fully migrated db> --to-schema-datamodel prisma/schema.prisma --script
-- The timestamp types and column defaults were fixed on the schema side in
-- the same change (the database was right), so what remains is:
--   * 48 foreign keys recreated as schema.prisma declares them. Four were
--     missing (field_submissions.review_claimed_by_user_id,
--     tcfd_scenarios.created_by_user_id, tcfd_risk_assessments.owner_user_id,
--     hs_incident_reports.method_statement_id; production had no orphan
--     rows), and calculation_runs.triggered_by_user_id was ON DELETE RESTRICT,
--     which blocked deleting (or erasing) a user who had run a calculation;
--     it is now SET NULL. The rest only gain ON UPDATE CASCADE or change
--     NO ACTION to RESTRICT (same effect). No CASCADE rule is added.
--   * the partial unique index on published_snapshots.share_token replaced by
--     the plain one Prisma declares (same effect; no duplicates exist);
--   * 29 indexes renamed to Prisma's names, three hand-named TCFD/pilot
--     indexes replaced by the schema's (one pilot-flag index dropped).
-- contract-step: only index names change (ALTER INDEX ... RENAME TO); no
-- application code or query refers to an index by name, so the running
-- deploy is unaffected. No column or table is dropped, renamed or retyped.

-- DropForeignKey
ALTER TABLE "calculation_runs" DROP CONSTRAINT "calculation_runs_triggered_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "discharge_readings" DROP CONSTRAINT "discharge_readings_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "discharge_readings" DROP CONSTRAINT "discharge_readings_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "discharge_readings" DROP CONSTRAINT "discharge_readings_permit_condition_id_fkey";

-- DropForeignKey
ALTER TABLE "ecological_scans" DROP CONSTRAINT "ecological_scans_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "ecological_scans" DROP CONSTRAINT "ecological_scans_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "ecological_scans" DROP CONSTRAINT "ecological_scans_project_id_fkey";

-- DropForeignKey
ALTER TABLE "enforcement_notices" DROP CONSTRAINT "enforcement_notices_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "enforcement_notices" DROP CONSTRAINT "enforcement_notices_facility_id_fkey";

-- DropForeignKey
ALTER TABLE "enforcement_notices" DROP CONSTRAINT "enforcement_notices_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "enforcement_notices" DROP CONSTRAINT "enforcement_notices_owner_user_id_fkey";

-- DropForeignKey
ALTER TABLE "enforcement_notices" DROP CONSTRAINT "enforcement_notices_permit_id_fkey";

-- DropForeignKey
ALTER TABLE "enforcement_notices" DROP CONSTRAINT "enforcement_notices_site_id_fkey";

-- DropForeignKey
ALTER TABLE "evidence_access_logs" DROP CONSTRAINT "evidence_access_logs_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "hs_incident_reports" DROP CONSTRAINT "fk_hs_incident_method_statement";

-- DropForeignKey
ALTER TABLE "hs_incident_reports" DROP CONSTRAINT "hs_incident_reports_facility_id_fkey";

-- DropForeignKey
ALTER TABLE "hs_incident_reports" DROP CONSTRAINT "hs_incident_reports_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "hs_incident_reports" DROP CONSTRAINT "hs_incident_reports_owner_user_id_fkey";

-- DropForeignKey
ALTER TABLE "hs_incident_reports" DROP CONSTRAINT "hs_incident_reports_project_id_fkey";

-- DropForeignKey
ALTER TABLE "hs_incident_reports" DROP CONSTRAINT "hs_incident_reports_reported_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "hs_incident_reports" DROP CONSTRAINT "hs_incident_reports_site_id_fkey";

-- DropForeignKey
ALTER TABLE "materiality_assessments" DROP CONSTRAINT "materiality_assessments_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "materiality_assessments" DROP CONSTRAINT "materiality_assessments_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "materiality_assessments" DROP CONSTRAINT "materiality_assessments_reporting_period_id_fkey";

-- DropForeignKey
ALTER TABLE "materiality_topics" DROP CONSTRAINT "materiality_topics_assessment_id_fkey";

-- DropForeignKey
ALTER TABLE "materiality_topics" DROP CONSTRAINT "materiality_topics_owner_user_id_fkey";

-- DropForeignKey
ALTER TABLE "method_statements" DROP CONSTRAINT "method_statements_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "method_statements" DROP CONSTRAINT "method_statements_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "method_statements" DROP CONSTRAINT "method_statements_project_id_fkey";

-- DropForeignKey
ALTER TABLE "method_statements" DROP CONSTRAINT "method_statements_signed_off_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "method_statements" DROP CONSTRAINT "method_statements_site_id_fkey";

-- DropForeignKey
ALTER TABLE "programmes" DROP CONSTRAINT "programmes_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "programmes" DROP CONSTRAINT "programmes_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "programmes" DROP CONSTRAINT "programmes_programme_manager_user_id_fkey";

-- DropForeignKey
ALTER TABLE "projects" DROP CONSTRAINT "projects_programme_id_fkey";

-- DropForeignKey
ALTER TABLE "supplier_profiles" DROP CONSTRAINT "supplier_profiles_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "tcfd_risk_assessments" DROP CONSTRAINT "tcfd_risk_assessments_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "tcfd_risk_assessments" DROP CONSTRAINT "tcfd_risk_assessments_scenario_id_fkey";

-- DropForeignKey
ALTER TABLE "tcfd_scenarios" DROP CONSTRAINT "tcfd_scenarios_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "tnfd_scenarios" DROP CONSTRAINT "tnfd_scenarios_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "tnfd_scenarios" DROP CONSTRAINT "tnfd_scenarios_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "worker_sessions" DROP CONSTRAINT "worker_sessions_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "worker_sessions" DROP CONSTRAINT "worker_sessions_project_id_fkey";

-- DropForeignKey
ALTER TABLE "worker_sessions" DROP CONSTRAINT "worker_sessions_site_id_fkey";

-- DropForeignKey
ALTER TABLE "worker_sessions" DROP CONSTRAINT "worker_sessions_user_id_fkey";

-- DropIndex
DROP INDEX "idx_organizations_is_pilot";

-- DropIndex
DROP INDEX "idx_tcfd_risks_org";

-- DropIndex
DROP INDEX "idx_tcfd_risks_scenario";

-- DropIndex
DROP INDEX "idx_tcfd_scenarios_org";

-- CreateIndex
-- An earlier migration created this name as a partial unique index
-- (WHERE share_token IS NOT NULL); a plain unique index enforces the same
-- thing (NULLs never conflict) and is what Prisma expects.
DROP INDEX IF EXISTS "published_snapshots_share_token_key";
CREATE UNIQUE INDEX "published_snapshots_share_token_key" ON "published_snapshots"("share_token");

-- CreateIndex
CREATE INDEX "tcfd_risk_assessments_organization_id_scenario_id_idx" ON "tcfd_risk_assessments"("organization_id", "scenario_id");

-- CreateIndex
CREATE INDEX "tcfd_scenarios_organization_id_scenario_type_idx" ON "tcfd_scenarios"("organization_id", "scenario_type");

-- AddForeignKey
ALTER TABLE "field_submissions" ADD CONSTRAINT "field_submissions_review_claimed_by_user_id_fkey" FOREIGN KEY ("review_claimed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_runs" ADD CONSTRAINT "calculation_runs_triggered_by_user_id_fkey" FOREIGN KEY ("triggered_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_programme_id_fkey" FOREIGN KEY ("programme_id") REFERENCES "programmes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecological_scans" ADD CONSTRAINT "ecological_scans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecological_scans" ADD CONSTRAINT "ecological_scans_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecological_scans" ADD CONSTRAINT "ecological_scans_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tcfd_scenarios" ADD CONSTRAINT "tcfd_scenarios_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tcfd_scenarios" ADD CONSTRAINT "tcfd_scenarios_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tcfd_risk_assessments" ADD CONSTRAINT "tcfd_risk_assessments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tcfd_risk_assessments" ADD CONSTRAINT "tcfd_risk_assessments_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "tcfd_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tcfd_risk_assessments" ADD CONSTRAINT "tcfd_risk_assessments_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hs_incident_reports" ADD CONSTRAINT "hs_incident_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hs_incident_reports" ADD CONSTRAINT "hs_incident_reports_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hs_incident_reports" ADD CONSTRAINT "hs_incident_reports_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hs_incident_reports" ADD CONSTRAINT "hs_incident_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hs_incident_reports" ADD CONSTRAINT "hs_incident_reports_method_statement_id_fkey" FOREIGN KEY ("method_statement_id") REFERENCES "method_statements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hs_incident_reports" ADD CONSTRAINT "hs_incident_reports_reported_by_user_id_fkey" FOREIGN KEY ("reported_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hs_incident_reports" ADD CONSTRAINT "hs_incident_reports_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_statements" ADD CONSTRAINT "method_statements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_statements" ADD CONSTRAINT "method_statements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_statements" ADD CONSTRAINT "method_statements_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_statements" ADD CONSTRAINT "method_statements_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_statements" ADD CONSTRAINT "method_statements_signed_off_by_user_id_fkey" FOREIGN KEY ("signed_off_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_sessions" ADD CONSTRAINT "worker_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_sessions" ADD CONSTRAINT "worker_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_sessions" ADD CONSTRAINT "worker_sessions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_sessions" ADD CONSTRAINT "worker_sessions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programmes" ADD CONSTRAINT "programmes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programmes" ADD CONSTRAINT "programmes_programme_manager_user_id_fkey" FOREIGN KEY ("programme_manager_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programmes" ADD CONSTRAINT "programmes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enforcement_notices" ADD CONSTRAINT "enforcement_notices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enforcement_notices" ADD CONSTRAINT "enforcement_notices_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enforcement_notices" ADD CONSTRAINT "enforcement_notices_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enforcement_notices" ADD CONSTRAINT "enforcement_notices_permit_id_fkey" FOREIGN KEY ("permit_id") REFERENCES "environmental_permits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enforcement_notices" ADD CONSTRAINT "enforcement_notices_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enforcement_notices" ADD CONSTRAINT "enforcement_notices_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_readings" ADD CONSTRAINT "discharge_readings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_readings" ADD CONSTRAINT "discharge_readings_permit_condition_id_fkey" FOREIGN KEY ("permit_condition_id") REFERENCES "permit_conditions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_readings" ADD CONSTRAINT "discharge_readings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_profiles" ADD CONSTRAINT "supplier_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiality_assessments" ADD CONSTRAINT "materiality_assessments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiality_assessments" ADD CONSTRAINT "materiality_assessments_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiality_assessments" ADD CONSTRAINT "materiality_assessments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiality_topics" ADD CONSTRAINT "materiality_topics_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "materiality_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiality_topics" ADD CONSTRAINT "materiality_topics_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tnfd_scenarios" ADD CONSTRAINT "tnfd_scenarios_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tnfd_scenarios" ADD CONSTRAINT "tnfd_scenarios_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_access_logs" ADD CONSTRAINT "evidence_access_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "carbon_signals_org_type_time_idx" RENAME TO "carbon_signals_organization_id_signal_type_recorded_at_idx";

-- RenameIndex
ALTER INDEX "idx_discharge_readings_condition" RENAME TO "discharge_readings_organization_id_permit_condition_id_read_idx";

-- RenameIndex
ALTER INDEX "idx_discharge_readings_exceedance" RENAME TO "discharge_readings_organization_id_exceedance_idx";

-- RenameIndex
ALTER INDEX "idx_enforcement_notices_org_status" RENAME TO "enforcement_notices_organization_id_status_compliance_deadl_idx";

-- RenameIndex
ALTER INDEX "idx_enforcement_notices_permit" RENAME TO "enforcement_notices_organization_id_permit_id_idx";

-- RenameIndex
ALTER INDEX "idx_evidence_access_logs_file" RENAME TO "evidence_access_logs_organization_id_evidence_file_id_creat_idx";

-- RenameIndex
ALTER INDEX "idx_evidence_access_logs_user" RENAME TO "evidence_access_logs_organization_id_accessed_by_user_id_cr_idx";

-- RenameIndex
ALTER INDEX "external_api_credentials_org_active_idx" RENAME TO "external_api_credentials_organization_id_is_active_idx";

-- RenameIndex
ALTER INDEX "geographic_impacts_org_type_time_idx" RENAME TO "geographic_impacts_organization_id_impact_type_recorded_at_idx";

-- RenameIndex
ALTER INDEX "idx_hs_incidents_org_status" RENAME TO "hs_incident_reports_organization_id_status_occurred_at_idx";

-- RenameIndex
ALTER INDEX "idx_hs_incidents_org_type" RENAME TO "hs_incident_reports_organization_id_incident_type_idx";

-- RenameIndex
ALTER INDEX "impact_alerts_org_resolved_idx" RENAME TO "impact_alerts_organization_id_resolved_at_idx";

-- RenameIndex
ALTER INDEX "impact_alerts_org_type_time_idx" RENAME TO "impact_alerts_organization_id_alert_type_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_materiality_assessments_org_status" RENAME TO "materiality_assessments_organization_id_status_idx";

-- RenameIndex
ALTER INDEX "idx_materiality_topics_assessment" RENAME TO "materiality_topics_assessment_id_idx";

-- RenameIndex
ALTER INDEX "idx_materiality_topics_org_esrs" RENAME TO "materiality_topics_organization_id_esrs_code_idx";

-- RenameIndex
ALTER INDEX "idx_method_statements_org_project" RENAME TO "method_statements_organization_id_project_id_idx";

-- RenameIndex
ALTER INDEX "idx_method_statements_org_status" RENAME TO "method_statements_organization_id_status_idx";

-- RenameIndex
ALTER INDEX "idx_programmes_org_status" RENAME TO "programmes_organization_id_status_idx";

-- RenameIndex
ALTER INDEX "idx_supplier_profiles_org_carrier" RENAME TO "supplier_profiles_organization_id_waste_carrier_expires_at_idx";

-- RenameIndex
ALTER INDEX "idx_supplier_profiles_org_living_wage" RENAME TO "supplier_profiles_organization_id_living_wage_declared_idx";

-- RenameIndex
ALTER INDEX "sv_activities_org_commitment_idx" RENAME TO "sv_activities_organization_id_commitment_id_idx";

-- RenameIndex
ALTER INDEX "sv_activities_org_date_idx" RENAME TO "sv_activities_organization_id_activity_date_idx";

-- RenameIndex
ALTER INDEX "sv_activities_org_status_idx" RENAME TO "sv_activities_organization_id_status_idx";

-- RenameIndex
ALTER INDEX "sv_commitments_org_contract_idx" RENAME TO "sv_commitments_organization_id_contract_id_idx";

-- RenameIndex
ALTER INDEX "sv_commitments_org_status_idx" RENAME TO "sv_commitments_organization_id_status_idx";

-- RenameIndex
ALTER INDEX "idx_tnfd_scenarios_org" RENAME TO "tnfd_scenarios_organization_id_risk_rating_idx";

-- RenameIndex
ALTER INDEX "idx_worker_sessions_org_user" RENAME TO "worker_sessions_organization_id_user_id_started_at_idx";

-- RenameIndex
ALTER INDEX "idx_worker_sessions_overdue" RENAME TO "worker_sessions_organization_id_overdue_alert_idx";

