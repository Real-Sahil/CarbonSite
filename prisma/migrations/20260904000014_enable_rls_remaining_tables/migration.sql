-- Closes a real security gap found live via Supabase's security advisor
-- (rls_disabled_in_public, ERROR level): every table added since the Sept 1
-- RLS remediation (docs/security/rls-remediation-plan.md) shipped with zero
-- row-level security. This does not affect the app itself -- Prisma always
-- connects as the `postgres` role, which bypasses RLS entirely -- but it
-- means any direct PostgREST/REST call using the project's anon or
-- authenticated key could read or write these tables across tenants.
-- Matches the deny-by-default pattern already established for every other
-- table: is_org_member_for_rls() is a deliberately always-false
-- SECURITY DEFINER function (this app uses Better Auth, never Supabase
-- Auth, so auth.uid() never populates), so these policies deny all
-- PostgREST access while leaving the app's own `postgres`-role connection
-- untouched.

-- Part 1: tables with existing (auth.uid()-based, structurally deny-all)
-- policies that just need RLS turned on.
ALTER TABLE "airbyte_sync_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_quality_checks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_batch_quality_scores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scope3_estimates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scope3_estimation_models" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staged_external_data" ENABLE ROW LEVEL SECURITY;

-- Part 2: org-scoped tables with no RLS and no policy at all.
ALTER TABLE "airbite_connectors" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "airbite_connectors_org_access" ON "airbite_connectors" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "airbite_connectors_org_insert" ON "airbite_connectors" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "airbite_connectors_org_update" ON "airbite_connectors" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "airbite_connectors_org_delete" ON "airbite_connectors" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "airbyte_sync_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "airbyte_sync_logs_org_access" ON "airbyte_sync_logs" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "airbyte_sync_logs_org_insert" ON "airbyte_sync_logs" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "airbyte_sync_logs_org_update" ON "airbyte_sync_logs" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "airbyte_sync_logs_org_delete" ON "airbyte_sync_logs" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "analytics_dashboard_cache" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analytics_dashboard_cache_org_access" ON "analytics_dashboard_cache" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "analytics_dashboard_cache_org_insert" ON "analytics_dashboard_cache" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "analytics_dashboard_cache_org_update" ON "analytics_dashboard_cache" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "analytics_dashboard_cache_org_delete" ON "analytics_dashboard_cache" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "assurance_engagements" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assurance_engagements_org_access" ON "assurance_engagements" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "assurance_engagements_org_insert" ON "assurance_engagements" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "assurance_engagements_org_update" ON "assurance_engagements" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "assurance_engagements_org_delete" ON "assurance_engagements" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "assurance_findings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assurance_findings_org_access" ON "assurance_findings" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "assurance_findings_org_insert" ON "assurance_findings" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "assurance_findings_org_update" ON "assurance_findings" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "assurance_findings_org_delete" ON "assurance_findings" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "assurance_samples" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assurance_samples_org_access" ON "assurance_samples" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "assurance_samples_org_insert" ON "assurance_samples" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "assurance_samples_org_update" ON "assurance_samples" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "assurance_samples_org_delete" ON "assurance_samples" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "audit_contexts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_contexts_org_access" ON "audit_contexts" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "audit_contexts_org_insert" ON "audit_contexts" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "audit_contexts_org_update" ON "audit_contexts" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "audit_contexts_org_delete" ON "audit_contexts" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_events_org_access" ON "audit_events" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "audit_events_org_insert" ON "audit_events" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "audit_events_org_update" ON "audit_events" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "audit_events_org_delete" ON "audit_events" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "base_year_recalculations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "base_year_recalculations_org_access" ON "base_year_recalculations" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "base_year_recalculations_org_insert" ON "base_year_recalculations" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "base_year_recalculations_org_update" ON "base_year_recalculations" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "base_year_recalculations_org_delete" ON "base_year_recalculations" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "base_years" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "base_years_org_access" ON "base_years" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "base_years_org_insert" ON "base_years" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "base_years_org_update" ON "base_years" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "base_years_org_delete" ON "base_years" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "batch_jobs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batch_jobs_org_access" ON "batch_jobs" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "batch_jobs_org_insert" ON "batch_jobs" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "batch_jobs_org_update" ON "batch_jobs" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "batch_jobs_org_delete" ON "batch_jobs" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "biodiversity_assessments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "biodiversity_assessments_org_access" ON "biodiversity_assessments" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "biodiversity_assessments_org_insert" ON "biodiversity_assessments" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "biodiversity_assessments_org_update" ON "biodiversity_assessments" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "biodiversity_assessments_org_delete" ON "biodiversity_assessments" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "calculation_uncertainty_results" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calculation_uncertainty_results_org_access" ON "calculation_uncertainty_results" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "calculation_uncertainty_results_org_insert" ON "calculation_uncertainty_results" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "calculation_uncertainty_results_org_update" ON "calculation_uncertainty_results" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "calculation_uncertainty_results_org_delete" ON "calculation_uncertainty_results" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "causal_analyses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "causal_analyses_org_access" ON "causal_analyses" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "causal_analyses_org_insert" ON "causal_analyses" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "causal_analyses_org_update" ON "causal_analyses" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "causal_analyses_org_delete" ON "causal_analyses" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "causal_inference_runs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "causal_inference_runs_org_access" ON "causal_inference_runs" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "causal_inference_runs_org_insert" ON "causal_inference_runs" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "causal_inference_runs_org_update" ON "causal_inference_runs" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "causal_inference_runs_org_delete" ON "causal_inference_runs" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "corrective_actions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "corrective_actions_org_access" ON "corrective_actions" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "corrective_actions_org_insert" ON "corrective_actions" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "corrective_actions_org_update" ON "corrective_actions" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "corrective_actions_org_delete" ON "corrective_actions" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "data_completeness_requirements" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "data_completeness_requirements_org_access" ON "data_completeness_requirements" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "data_completeness_requirements_org_insert" ON "data_completeness_requirements" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "data_completeness_requirements_org_update" ON "data_completeness_requirements" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "data_completeness_requirements_org_delete" ON "data_completeness_requirements" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "dbt_runs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dbt_runs_org_access" ON "dbt_runs" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "dbt_runs_org_insert" ON "dbt_runs" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "dbt_runs_org_update" ON "dbt_runs" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "dbt_runs_org_delete" ON "dbt_runs" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "ecological_monitoring_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ecological_monitoring_events_org_access" ON "ecological_monitoring_events" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "ecological_monitoring_events_org_insert" ON "ecological_monitoring_events" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "ecological_monitoring_events_org_update" ON "ecological_monitoring_events" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "ecological_monitoring_events_org_delete" ON "ecological_monitoring_events" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "emissions_forecasts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emissions_forecasts_org_access" ON "emissions_forecasts" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "emissions_forecasts_org_insert" ON "emissions_forecasts" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "emissions_forecasts_org_update" ON "emissions_forecasts" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "emissions_forecasts_org_delete" ON "emissions_forecasts" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "environmental_aspects" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "environmental_aspects_org_access" ON "environmental_aspects" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "environmental_aspects_org_insert" ON "environmental_aspects" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "environmental_aspects_org_update" ON "environmental_aspects" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "environmental_aspects_org_delete" ON "environmental_aspects" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "environmental_incidents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "environmental_incidents_org_access" ON "environmental_incidents" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "environmental_incidents_org_insert" ON "environmental_incidents" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "environmental_incidents_org_update" ON "environmental_incidents" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "environmental_incidents_org_delete" ON "environmental_incidents" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "environmental_permits" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "environmental_permits_org_access" ON "environmental_permits" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "environmental_permits_org_insert" ON "environmental_permits" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "environmental_permits_org_update" ON "environmental_permits" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "environmental_permits_org_delete" ON "environmental_permits" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "evidence_requests" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence_requests_org_access" ON "evidence_requests" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "evidence_requests_org_insert" ON "evidence_requests" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "evidence_requests_org_update" ON "evidence_requests" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "evidence_requests_org_delete" ON "evidence_requests" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "forecasts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "forecasts_org_access" ON "forecasts" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "forecasts_org_insert" ON "forecasts" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "forecasts_org_update" ON "forecasts" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "forecasts_org_delete" ON "forecasts" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "habitat_management_plans" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "habitat_management_plans_org_access" ON "habitat_management_plans" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "habitat_management_plans_org_insert" ON "habitat_management_plans" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "habitat_management_plans_org_update" ON "habitat_management_plans" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "habitat_management_plans_org_delete" ON "habitat_management_plans" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "habitat_parcels" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "habitat_parcels_org_access" ON "habitat_parcels" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "habitat_parcels_org_insert" ON "habitat_parcels" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "habitat_parcels_org_update" ON "habitat_parcels" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "habitat_parcels_org_delete" ON "habitat_parcels" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "integration_configs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integration_configs_org_access" ON "integration_configs" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "integration_configs_org_insert" ON "integration_configs" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "integration_configs_org_update" ON "integration_configs" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "integration_configs_org_delete" ON "integration_configs" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "invoice_anomalies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_anomalies_org_access" ON "invoice_anomalies" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "invoice_anomalies_org_insert" ON "invoice_anomalies" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "invoice_anomalies_org_update" ON "invoice_anomalies" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "invoice_anomalies_org_delete" ON "invoice_anomalies" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "invoice_reconciliations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_reconciliations_org_access" ON "invoice_reconciliations" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "invoice_reconciliations_org_insert" ON "invoice_reconciliations" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "invoice_reconciliations_org_update" ON "invoice_reconciliations" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "invoice_reconciliations_org_delete" ON "invoice_reconciliations" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "invoice_records" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_records_org_access" ON "invoice_records" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "invoice_records_org_insert" ON "invoice_records" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "invoice_records_org_update" ON "invoice_records" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "invoice_records_org_delete" ON "invoice_records" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "legal_entities" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "legal_entities_org_access" ON "legal_entities" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "legal_entities_org_insert" ON "legal_entities" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "legal_entities_org_update" ON "legal_entities" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "legal_entities_org_delete" ON "legal_entities" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "legal_register_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "legal_register_entries_org_access" ON "legal_register_entries" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "legal_register_entries_org_insert" ON "legal_register_entries" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "legal_register_entries_org_update" ON "legal_register_entries" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "legal_register_entries_org_delete" ON "legal_register_entries" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "model_explanations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "model_explanations_org_access" ON "model_explanations" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "model_explanations_org_insert" ON "model_explanations" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "model_explanations_org_update" ON "model_explanations" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "model_explanations_org_delete" ON "model_explanations" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "n8n_executions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "n8n_executions_org_access" ON "n8n_executions" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "n8n_executions_org_insert" ON "n8n_executions" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "n8n_executions_org_update" ON "n8n_executions" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "n8n_executions_org_delete" ON "n8n_executions" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "n8n_workflows" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "n8n_workflows_org_access" ON "n8n_workflows" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "n8n_workflows_org_insert" ON "n8n_workflows" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "n8n_workflows_org_update" ON "n8n_workflows" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "n8n_workflows_org_delete" ON "n8n_workflows" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_org_access" ON "notifications" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "notifications_org_insert" ON "notifications" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "notifications_org_update" ON "notifications" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "notifications_org_delete" ON "notifications" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "organization_datapoint_statuses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organization_datapoint_statuses_org_access" ON "organization_datapoint_statuses" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "organization_datapoint_statuses_org_insert" ON "organization_datapoint_statuses" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "organization_datapoint_statuses_org_update" ON "organization_datapoint_statuses" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "organization_datapoint_statuses_org_delete" ON "organization_datapoint_statuses" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "permit_conditions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permit_conditions_org_access" ON "permit_conditions" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "permit_conditions_org_insert" ON "permit_conditions" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "permit_conditions_org_update" ON "permit_conditions" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "permit_conditions_org_delete" ON "permit_conditions" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "protected_species_records" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "protected_species_records_org_access" ON "protected_species_records" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "protected_species_records_org_insert" ON "protected_species_records" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "protected_species_records_org_update" ON "protected_species_records" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "protected_species_records_org_delete" ON "protected_species_records" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "restatements" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restatements_org_access" ON "restatements" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "restatements_org_insert" ON "restatements" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "restatements_org_update" ON "restatements" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "restatements_org_delete" ON "restatements" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "sso_configurations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sso_configurations_org_access" ON "sso_configurations" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "sso_configurations_org_insert" ON "sso_configurations" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "sso_configurations_org_update" ON "sso_configurations" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "sso_configurations_org_delete" ON "sso_configurations" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "sso_sessions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sso_sessions_org_access" ON "sso_sessions" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "sso_sessions_org_insert" ON "sso_sessions" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "sso_sessions_org_update" ON "sso_sessions" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "sso_sessions_org_delete" ON "sso_sessions" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "structural_changes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "structural_changes_org_access" ON "structural_changes" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "structural_changes_org_insert" ON "structural_changes" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "structural_changes_org_update" ON "structural_changes" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "structural_changes_org_delete" ON "structural_changes" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "subcontractor_carbon_submissions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subcontractor_carbon_submissions_org_access" ON "subcontractor_carbon_submissions" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "subcontractor_carbon_submissions_org_insert" ON "subcontractor_carbon_submissions" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "subcontractor_carbon_submissions_org_update" ON "subcontractor_carbon_submissions" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "subcontractor_carbon_submissions_org_delete" ON "subcontractor_carbon_submissions" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "supplier_analytics" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_analytics_org_access" ON "supplier_analytics" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "supplier_analytics_org_insert" ON "supplier_analytics" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "supplier_analytics_org_update" ON "supplier_analytics" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "supplier_analytics_org_delete" ON "supplier_analytics" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "supplier_performance" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_performance_org_access" ON "supplier_performance" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "supplier_performance_org_insert" ON "supplier_performance" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "supplier_performance_org_update" ON "supplier_performance" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "supplier_performance_org_delete" ON "supplier_performance" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "supplier_performance_history" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_performance_history_org_access" ON "supplier_performance_history" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "supplier_performance_history_org_insert" ON "supplier_performance_history" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "supplier_performance_history_org_update" ON "supplier_performance_history" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "supplier_performance_history_org_delete" ON "supplier_performance_history" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "supplier_reports" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_reports_org_access" ON "supplier_reports" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "supplier_reports_org_insert" ON "supplier_reports" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "supplier_reports_org_update" ON "supplier_reports" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "supplier_reports_org_delete" ON "supplier_reports" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "whole_life_carbon_assessments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "whole_life_carbon_assessments_org_access" ON "whole_life_carbon_assessments" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "whole_life_carbon_assessments_org_insert" ON "whole_life_carbon_assessments" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "whole_life_carbon_assessments_org_update" ON "whole_life_carbon_assessments" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "whole_life_carbon_assessments_org_delete" ON "whole_life_carbon_assessments" FOR DELETE USING (is_org_member_for_rls(organization_id));

-- Part 3: framework_datapoints is global reference data (framework/datapoint
-- crosswalk definitions), not tenant-scoped -- read-only for all, matching
-- the embodied_materials pattern in 20260825153826_enable_rls_missing_tables.
ALTER TABLE "framework_datapoints" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "framework_datapoints_read" ON "framework_datapoints" FOR SELECT USING (true);

-- Part 4: lock down SECURITY DEFINER functions flagged by the advisor as
-- executable by anon/authenticated via PostgREST RPC. Both app functions are
-- structurally deny-all today (auth.uid() never matches a Better Auth user
-- id), but a SECURITY DEFINER function reachable by anon is worth closing
-- regardless of current behavior -- a future change to either function's
-- body should not silently become an exploitable RPC endpoint. They remain
-- fully usable by RLS policies themselves (policy evaluation doesn't go
-- through the PostgREST RPC/EXECUTE-grant path).
--
-- Guarded per-function and broad (WHEN OTHERS), matching the pgaudit
-- best-effort precedent in 20260828_add_pgaudit_fixed: is_org_member()
-- predates this repo's migration history (created directly against
-- production, not through any tracked migration), the two pgaudit_*
-- functions only exist where the pgaudit extension is actually installed,
-- and the `anon`/`authenticated` roles themselves are Supabase-specific --
-- none of that is present on a fresh local/CI/vanilla Postgres instance, so
-- a bare REVOKE would fail `prisma migrate deploy` there either on
-- "function does not exist" or "role does not exist".
DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.is_org_member(text) FROM anon, authenticated;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping revoke on public.is_org_member(text): % (expected on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.is_org_member_for_rls(text) FROM anon, authenticated;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping revoke on public.is_org_member_for_rls(text): % (expected on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.pgaudit_ddl_command_end() FROM anon, authenticated;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping revoke on public.pgaudit_ddl_command_end(): % (expected when pgaudit/Supabase roles are unavailable, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.pgaudit_sql_drop() FROM anon, authenticated;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping revoke on public.pgaudit_sql_drop(): % (expected when pgaudit/Supabase roles are unavailable, e.g. local dev/CI)', SQLERRM;
END $$;
