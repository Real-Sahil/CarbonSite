-- Reconciles the last two categories of drift `prisma migrate diff` reported
-- after the two prior reconciliation migrations: 75 index renames (purely
-- cosmetic - Prisma only classifies a change as RenameIndex when the
-- underlying index definition, columns, uniqueness, any partial predicate,
-- is identical and only the name differs; ALTER INDEX ... RENAME is a fast
-- catalog-only operation, no table rewrite, no meaningful lock) and 42
-- foreign keys where only ON UPDATE NO ACTION -> CASCADE differs (every
-- primary key in this schema is an immutable cuid string assigned once at
-- creation and never reassigned, so ON UPDATE never fires either way -
-- checked by comparing every one of these 42 against its current database
-- definition: zero had any ON DELETE difference, confirmed via
-- prisma migrate diff on a freshly migrated database before writing this).

-- Foreign keys: ON UPDATE NO ACTION -> CASCADE (42)

ALTER TABLE "airbite_connectors" DROP CONSTRAINT IF EXISTS "airbite_connectors_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "airbite_connectors" ADD CONSTRAINT "airbite_connectors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "airbyte_sync_connections" DROP CONSTRAINT IF EXISTS "airbyte_sync_connections_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "airbyte_sync_connections" ADD CONSTRAINT "airbyte_sync_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "airbyte_sync_logs" DROP CONSTRAINT IF EXISTS "airbyte_sync_logs_connector_id_fkey";
DO $$ BEGIN
  ALTER TABLE "airbyte_sync_logs" ADD CONSTRAINT "airbyte_sync_logs_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "airbite_connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "airbyte_sync_logs" DROP CONSTRAINT IF EXISTS "airbyte_sync_logs_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "airbyte_sync_logs" ADD CONSTRAINT "airbyte_sync_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "audit_events" DROP CONSTRAINT IF EXISTS "audit_events_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "carbon_budget_phases" DROP CONSTRAINT IF EXISTS "carbon_budget_phases_budget_id_fkey";
DO $$ BEGIN
  ALTER TABLE "carbon_budget_phases" ADD CONSTRAINT "carbon_budget_phases_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "carbon_budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "carbon_budgets" DROP CONSTRAINT IF EXISTS "carbon_budgets_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "carbon_budgets" ADD CONSTRAINT "carbon_budgets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "carbon_budgets" DROP CONSTRAINT IF EXISTS "carbon_budgets_project_id_fkey";
DO $$ BEGIN
  ALTER TABLE "carbon_budgets" ADD CONSTRAINT "carbon_budgets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "causal_inference_runs" DROP CONSTRAINT IF EXISTS "causal_inference_runs_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "causal_inference_runs" ADD CONSTRAINT "causal_inference_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "data_quality_checks" DROP CONSTRAINT IF EXISTS "data_quality_checks_import_batch_id_fkey";
DO $$ BEGIN
  ALTER TABLE "data_quality_checks" ADD CONSTRAINT "data_quality_checks_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "data_quality_checks" DROP CONSTRAINT IF EXISTS "data_quality_checks_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "data_quality_checks" ADD CONSTRAINT "data_quality_checks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "dbt_runs" DROP CONSTRAINT IF EXISTS "dbt_runs_calculation_run_id_fkey";
DO $$ BEGIN
  ALTER TABLE "dbt_runs" ADD CONSTRAINT "dbt_runs_calculation_run_id_fkey" FOREIGN KEY ("calculation_run_id") REFERENCES "calculation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "dbt_runs" DROP CONSTRAINT IF EXISTS "dbt_runs_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "dbt_runs" ADD CONSTRAINT "dbt_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "embodied_carbon_records" DROP CONSTRAINT IF EXISTS "embodied_carbon_records_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "embodied_carbon_records" ADD CONSTRAINT "embodied_carbon_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "epd_records" DROP CONSTRAINT IF EXISTS "epd_records_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "epd_records" ADD CONSTRAINT "epd_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "forecasts" DROP CONSTRAINT IF EXISTS "forecasts_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "import_batch_quality_scores" DROP CONSTRAINT IF EXISTS "import_batch_quality_scores_import_batch_id_fkey";
DO $$ BEGIN
  ALTER TABLE "import_batch_quality_scores" ADD CONSTRAINT "import_batch_quality_scores_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "import_batch_quality_scores" DROP CONSTRAINT IF EXISTS "import_batch_quality_scores_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "import_batch_quality_scores" ADD CONSTRAINT "import_batch_quality_scores_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "invoice_anomalies" DROP CONSTRAINT IF EXISTS "invoice_anomalies_invoice_id_fkey";
DO $$ BEGIN
  ALTER TABLE "invoice_anomalies" ADD CONSTRAINT "invoice_anomalies_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "invoice_anomalies" DROP CONSTRAINT IF EXISTS "invoice_anomalies_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "invoice_anomalies" ADD CONSTRAINT "invoice_anomalies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "invoice_anomalies" DROP CONSTRAINT IF EXISTS "invoice_anomalies_resolved_by_fkey";
DO $$ BEGIN
  ALTER TABLE "invoice_anomalies" ADD CONSTRAINT "invoice_anomalies_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "invoice_reconciliations" DROP CONSTRAINT IF EXISTS "invoice_reconciliations_invoice_id_fkey";
DO $$ BEGIN
  ALTER TABLE "invoice_reconciliations" ADD CONSTRAINT "invoice_reconciliations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "invoice_reconciliations" DROP CONSTRAINT IF EXISTS "invoice_reconciliations_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "invoice_reconciliations" ADD CONSTRAINT "invoice_reconciliations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "invoice_records" DROP CONSTRAINT IF EXISTS "invoice_records_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "invoice_records" ADD CONSTRAINT "invoice_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "payment_methods" DROP CONSTRAINT IF EXISTS "payment_methods_billing_subscription_id_fkey";
DO $$ BEGIN
  ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_billing_subscription_id_fkey" FOREIGN KEY ("billing_subscription_id") REFERENCES "billing_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "payment_methods" DROP CONSTRAINT IF EXISTS "payment_methods_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "sbti_targets" DROP CONSTRAINT IF EXISTS "sbti_targets_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "sbti_targets" ADD CONSTRAINT "sbti_targets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "scenario_drafts" DROP CONSTRAINT IF EXISTS "scenario_drafts_scenario_run_id_fkey";
DO $$ BEGIN
  ALTER TABLE "scenario_drafts" ADD CONSTRAINT "scenario_drafts_scenario_run_id_fkey" FOREIGN KEY ("scenario_run_id") REFERENCES "scenario_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "staged_external_data" DROP CONSTRAINT IF EXISTS "staged_external_data_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "staged_external_data" ADD CONSTRAINT "staged_external_data_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "supplier_category_assignments" DROP CONSTRAINT IF EXISTS "supplier_category_assignments_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "supplier_category_assignments" ADD CONSTRAINT "supplier_category_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "supplier_category_assignments" DROP CONSTRAINT IF EXISTS "supplier_category_assignments_supplier_id_fkey";
DO $$ BEGIN
  ALTER TABLE "supplier_category_assignments" ADD CONSTRAINT "supplier_category_assignments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "supplier_invites" DROP CONSTRAINT IF EXISTS "supplier_invites_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "supplier_invites" ADD CONSTRAINT "supplier_invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "supplier_performance_history" DROP CONSTRAINT IF EXISTS "supplier_performance_history_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "supplier_performance_history" ADD CONSTRAINT "supplier_performance_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "supplier_performance_history" DROP CONSTRAINT IF EXISTS "supplier_performance_history_supplier_performance_id_fkey";
DO $$ BEGIN
  ALTER TABLE "supplier_performance_history" ADD CONSTRAINT "supplier_performance_history_supplier_performance_id_fkey" FOREIGN KEY ("supplier_performance_id") REFERENCES "supplier_performance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "supplier_performance" DROP CONSTRAINT IF EXISTS "supplier_performance_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "supplier_performance" ADD CONSTRAINT "supplier_performance_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "supplier_performance" DROP CONSTRAINT IF EXISTS "supplier_performance_supplier_id_fkey";
DO $$ BEGIN
  ALTER TABLE "supplier_performance" ADD CONSTRAINT "supplier_performance_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "supplier_tag_assignments" DROP CONSTRAINT IF EXISTS "supplier_tag_assignments_supplier_id_fkey";
DO $$ BEGIN
  ALTER TABLE "supplier_tag_assignments" ADD CONSTRAINT "supplier_tag_assignments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "supplier_tag_assignments" DROP CONSTRAINT IF EXISTS "supplier_tag_assignments_tag_id_fkey";
DO $$ BEGIN
  ALTER TABLE "supplier_tag_assignments" ADD CONSTRAINT "supplier_tag_assignments_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "supplier_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "supplier_tags" DROP CONSTRAINT IF EXISTS "supplier_tags_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "supplier_tags" ADD CONSTRAINT "supplier_tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "waste_records" DROP CONSTRAINT IF EXISTS "waste_records_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "waste_records" ADD CONSTRAINT "waste_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "waste_records" DROP CONSTRAINT IF EXISTS "waste_records_project_id_fkey";
DO $$ BEGIN
  ALTER TABLE "waste_records" ADD CONSTRAINT "waste_records_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "xero_sync_logs" DROP CONSTRAINT IF EXISTS "xero_sync_logs_organization_id_fkey";
DO $$ BEGIN
  ALTER TABLE "xero_sync_logs" ADD CONSTRAINT "xero_sync_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Index renames, cosmetic only (75)

ALTER INDEX IF EXISTS "idx_airbyte_sync_connections_org_created" RENAME TO "airbyte_sync_connections_organization_id_created_at_idx";
ALTER INDEX IF EXISTS "idx_airbyte_sync_connections_org_system_enabled" RENAME TO "airbyte_sync_connections_organization_id_source_system_enab_idx";
ALTER INDEX IF EXISTS "assurance_engagements_org_period_idx" RENAME TO "assurance_engagements_organization_id_reporting_period_id_idx";
ALTER INDEX IF EXISTS "assurance_engagements_org_status_idx" RENAME TO "assurance_engagements_organization_id_status_idx";
ALTER INDEX IF EXISTS "assurance_findings_org_engagement_status_idx" RENAME TO "assurance_findings_organization_id_engagement_id_status_idx";
ALTER INDEX IF EXISTS "assurance_findings_org_severity_idx" RENAME TO "assurance_findings_organization_id_severity_idx";
ALTER INDEX IF EXISTS "assurance_samples_org_engagement_result_idx" RENAME TO "assurance_samples_organization_id_engagement_id_result_idx";
ALTER INDEX IF EXISTS "audit_contexts_organizationId_auditLogId_idx" RENAME TO "audit_contexts_organization_id_audit_log_id_idx";
ALTER INDEX IF EXISTS "audit_contexts_organizationId_framework_resourceType_resourceId" RENAME TO "audit_contexts_organization_id_framework_resource_type_reso_idx";
ALTER INDEX IF EXISTS "idx_audit_events_organization_action" RENAME TO "audit_events_organization_id_action_idx";
ALTER INDEX IF EXISTS "idx_audit_events_organization_table" RENAME TO "audit_events_organization_id_table_name_idx";
ALTER INDEX IF EXISTS "idx_audit_events_organization_timestamp" RENAME TO "audit_events_organization_id_timestamp_idx";
ALTER INDEX IF EXISTS "idx_audit_events_record_id" RENAME TO "audit_events_organization_id_table_name_record_id_idx";
ALTER INDEX IF EXISTS "biodiversity_assessments_org_project_idx" RENAME TO "biodiversity_assessments_organization_id_project_id_idx";
ALTER INDEX IF EXISTS "biodiversity_assessments_org_status_idx" RENAME TO "biodiversity_assessments_organization_id_status_idx";
ALTER INDEX IF EXISTS "corrective_actions_org_incident_idx" RENAME TO "corrective_actions_organization_id_incident_id_idx";
ALTER INDEX IF EXISTS "corrective_actions_org_status_due_idx" RENAME TO "corrective_actions_organization_id_status_due_on_idx";
ALTER INDEX IF EXISTS "dashboard_aggregates_org_snapshot_scope_idx" RENAME TO "dashboard_aggregates_organization_id_snapshot_id_scope_idx";
ALTER INDEX IF EXISTS "data_completeness_requirements_org_facility_category_key" RENAME TO "data_completeness_requirements_organization_id_facility_id__key";
ALTER INDEX IF EXISTS "idx_data_quality_org_batch" RENAME TO "data_quality_checks_organization_id_import_batch_id_idx";
ALTER INDEX IF EXISTS "idx_data_quality_org_created" RENAME TO "data_quality_checks_organization_id_created_at_idx";
ALTER INDEX IF EXISTS "idx_data_quality_org_type" RENAME TO "data_quality_checks_organization_id_check_type_idx";
ALTER INDEX IF EXISTS "ecological_monitoring_events_org_status_due_idx" RENAME TO "ecological_monitoring_events_organization_id_status_due_on_idx";
ALTER INDEX IF EXISTS "ecological_monitoring_events_plan_year_idx" RENAME TO "ecological_monitoring_events_management_plan_id_monitoring__idx";
ALTER INDEX IF EXISTS "embodied_carbon_records_org_period_idx" RENAME TO "embodied_carbon_records_organization_id_reporting_period_id_idx";
ALTER INDEX IF EXISTS "embodied_carbon_records_org_project_idx" RENAME TO "embodied_carbon_records_organization_id_project_id_idx";
ALTER INDEX IF EXISTS "environmental_aspects_org_facility_idx" RENAME TO "environmental_aspects_organization_id_facility_id_idx";
ALTER INDEX IF EXISTS "environmental_aspects_org_significance_idx" RENAME TO "environmental_aspects_organization_id_significance_idx";
ALTER INDEX IF EXISTS "environmental_incidents_org_facility_idx" RENAME TO "environmental_incidents_organization_id_facility_id_idx";
ALTER INDEX IF EXISTS "environmental_incidents_org_severity_occurred_idx" RENAME TO "environmental_incidents_organization_id_severity_occurred_a_idx";
ALTER INDEX IF EXISTS "environmental_incidents_org_status_occurred_idx" RENAME TO "environmental_incidents_organization_id_status_occurred_at_idx";
ALTER INDEX IF EXISTS "environmental_permits_org_facility_idx" RENAME TO "environmental_permits_organization_id_facility_id_idx";
ALTER INDEX IF EXISTS "environmental_permits_org_status_expiry_idx" RENAME TO "environmental_permits_organization_id_status_expires_on_idx";
ALTER INDEX IF EXISTS "evidence_requests_org_status_idx" RENAME TO "evidence_requests_organization_id_status_idx";
ALTER INDEX IF EXISTS "idx_field_submissions_deadline" RENAME TO "field_submissions_organization_id_requested_by_deadline_sub_idx";
ALTER INDEX IF EXISTS "field_worker_assignments_organization_id_reporting_period_id_id" RENAME TO "field_worker_assignments_organization_id_reporting_period_i_idx";
ALTER INDEX IF EXISTS "field_worker_assignments_organization_id_user_id_reporting_peri" RENAME TO "field_worker_assignments_organization_id_user_id_reporting__key";
ALTER INDEX IF EXISTS "field_worker_site_assignments_organization_id_user_id_site_i_ke" RENAME TO "field_worker_site_assignments_organization_id_user_id_site__key";
ALTER INDEX IF EXISTS "habitat_management_plans_org_idx" RENAME TO "habitat_management_plans_organization_id_idx";
ALTER INDEX IF EXISTS "habitat_parcels_assessment_stage_module_idx" RENAME TO "habitat_parcels_assessment_id_stage_module_idx";
ALTER INDEX IF EXISTS "habitat_parcels_org_assessment_idx" RENAME TO "habitat_parcels_organization_id_assessment_id_idx";
ALTER INDEX IF EXISTS "idx_batch_quality_org_created" RENAME TO "import_batch_quality_scores_organization_id_created_at_idx";
ALTER INDEX IF EXISTS "invoice_records_organization_id_source_system_external_invoice_" RENAME TO "invoice_records_organization_id_source_system_external_invo_key";
ALTER INDEX IF EXISTS "legal_register_entries_org_review_idx" RENAME TO "legal_register_entries_organization_id_next_review_on_idx";
ALTER INDEX IF EXISTS "legal_register_entries_org_status_idx" RENAME TO "legal_register_entries_organization_id_compliance_status_idx";
ALTER INDEX IF EXISTS "organization_datapoint_statuses_org_datapoint_key" RENAME TO "organization_datapoint_statuses_organization_id_datapoint_i_key";
ALTER INDEX IF EXISTS "organization_datapoint_statuses_org_idx" RENAME TO "organization_datapoint_statuses_organization_id_idx";
ALTER INDEX IF EXISTS "organization_emission_factors_organization_id_effective_start__" RENAME TO "organization_emission_factors_organization_id_effective_sta_idx";
ALTER INDEX IF EXISTS "organization_emission_factors_organization_id_scope_emission_ca" RENAME TO "organization_emission_factors_organization_id_scope_emissio_key";
ALTER INDEX IF EXISTS "permit_conditions_org_permit_idx" RENAME TO "permit_conditions_organization_id_permit_id_idx";
ALTER INDEX IF EXISTS "permit_conditions_org_status_due_idx" RENAME TO "permit_conditions_organization_id_compliance_status_next_du_idx";
ALTER INDEX IF EXISTS "protected_species_records_org_assessment_idx" RENAME TO "protected_species_records_organization_id_assessment_id_idx";
ALTER INDEX IF EXISTS "protected_species_records_org_licence_idx" RENAME TO "protected_species_records_organization_id_licence_status_idx";
ALTER INDEX IF EXISTS "published_snapshots_verification_idx" RENAME TO "published_snapshots_organization_id_verification_status_idx";
ALTER INDEX IF EXISTS "scenario_drafts_org_id" RENAME TO "scenario_drafts_organization_id_idx";
ALTER INDEX IF EXISTS "scenario_drafts_run_id" RENAME TO "scenario_drafts_scenario_run_id_idx";
ALTER INDEX IF EXISTS "scenario_runs_org_expiry" RENAME TO "scenario_runs_organization_id_expires_at_idx";
ALTER INDEX IF EXISTS "scope3_estimates_organization_id_emission_category_id_status_id" RENAME TO "scope3_estimates_organization_id_emission_category_id_statu_idx";
ALTER INDEX IF EXISTS "scope3_estimation_models_organization_id_emission_category_id_f" RENAME TO "scope3_estimation_models_organization_id_emission_category__key";
ALTER INDEX IF EXISTS "social_value_records_organization_id_contract_id_reporting_peri" RENAME TO "social_value_records_organization_id_contract_id_reporting__idx";
ALTER INDEX IF EXISTS "social_value_targets_organization_id_contract_id_reporting_peri" RENAME TO "social_value_targets_organization_id_contract_id_reporting__key";
ALTER INDEX IF EXISTS "sso_sessions_organizationId_providerUserId_key" RENAME TO "sso_sessions_organization_id_provider_user_id_key";
ALTER INDEX IF EXISTS "sso_sessions_organizationId_provider_idx" RENAME TO "sso_sessions_organization_id_provider_idx";
ALTER INDEX IF EXISTS "sso_sessions_organizationId_userId_idx" RENAME TO "sso_sessions_organization_id_user_id_idx";
ALTER INDEX IF EXISTS "idx_staged_external_data_org_created" RENAME TO "staged_external_data_organization_id_created_at_idx";
ALTER INDEX IF EXISTS "idx_staged_external_data_org_source_processed" RENAME TO "staged_external_data_organization_id_source_system_processe_idx";
ALTER INDEX IF EXISTS "idx_staged_external_data_org_type_processed" RENAME TO "staged_external_data_organization_id_data_type_processed_idx";
ALTER INDEX IF EXISTS "subcontractor_carbon_submissions_org_contract_status_idx" RENAME TO "subcontractor_carbon_submissions_organization_id_contract_i_idx";
ALTER INDEX IF EXISTS "subcontractor_carbon_submissions_org_due_date_idx" RENAME TO "subcontractor_carbon_submissions_organization_id_due_date_idx";
ALTER INDEX IF EXISTS "idx_supplier_performance_org" RENAME TO "supplier_performance_organization_id_idx";
ALTER INDEX IF EXISTS "idx_supplier_performance_org_supplier" RENAME TO "supplier_performance_organization_id_supplier_id_idx";
ALTER INDEX IF EXISTS "idx_supplier_performance_history_organization" RENAME TO "supplier_performance_history_organization_id_recorded_at_idx";
ALTER INDEX IF EXISTS "idx_supplier_performance_history_supplier" RENAME TO "supplier_performance_history_supplier_performance_id_record_idx";
ALTER INDEX IF EXISTS "xero_sync_logs_organizationId_invoiceId_lineItemIndex_key" RENAME TO "xero_sync_logs_organization_id_invoice_id_line_item_index_key";
ALTER INDEX IF EXISTS "xero_sync_logs_organizationId_processedAt_idx" RENAME TO "xero_sync_logs_organization_id_processed_at_idx";
