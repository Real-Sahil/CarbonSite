-- CarbonSite RLS Policies Migration
-- Enables secure multi-tenant data access based on organization membership

-- ============================================================================
-- HELPER: Ensure auth schema exists (Better Auth sessions)
-- ============================================================================

-- ============================================================================
-- USER-OWNED TABLES (user can only access their own records)
-- ============================================================================

-- sessions: users can only see their own sessions
CREATE POLICY sessions_user_isolation ON sessions
FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY sessions_user_insert ON sessions
FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY sessions_user_update ON sessions
FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY sessions_user_delete ON sessions
FOR DELETE USING (auth.uid()::text = user_id);

-- accounts: users can only see their own OAuth accounts
CREATE POLICY accounts_user_isolation ON accounts
FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY accounts_user_insert ON accounts
FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY accounts_user_update ON accounts
FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY accounts_user_delete ON accounts
FOR DELETE USING (auth.uid()::text = user_id);

-- device_tokens: users can only manage their own device tokens
CREATE POLICY device_tokens_user_isolation ON device_tokens
FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY device_tokens_user_insert ON device_tokens
FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY device_tokens_user_update ON device_tokens
FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY device_tokens_user_delete ON device_tokens
FOR DELETE USING (auth.uid()::text = user_id);

-- ============================================================================
-- ORGANIZATION-SCOPED TABLES (users can access org data they're members of)
-- ============================================================================

-- Helper: Check if user is member of org with proper casting
CREATE OR REPLACE FUNCTION is_org_member_for_rls(org_id uuid) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_membership
    WHERE user_id = auth.uid()::text AND organization_id = org_id::text
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- activity_records: org members can access their org's records
CREATE POLICY activity_records_org_access ON activity_records
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY activity_records_org_insert ON activity_records
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY activity_records_org_update ON activity_records
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY activity_records_org_delete ON activity_records
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- api_keys: org members can access their org's API keys
CREATE POLICY api_keys_org_access ON api_keys
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY api_keys_org_insert ON api_keys
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY api_keys_org_update ON api_keys
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY api_keys_org_delete ON api_keys
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- audit_log: org members can read (not modify) their org's audit logs
CREATE POLICY audit_log_org_read ON audit_log
FOR SELECT USING (is_org_member_for_rls(organization_id));

-- billing_subscriptions: org members can view their org's billing
CREATE POLICY billing_subscriptions_org_access ON billing_subscriptions
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY billing_subscriptions_org_insert ON billing_subscriptions
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY billing_subscriptions_org_update ON billing_subscriptions
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

-- calculation_runs: org members can access their org's calculation runs
CREATE POLICY calculation_runs_org_access ON calculation_runs
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY calculation_runs_org_insert ON calculation_runs
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY calculation_runs_org_update ON calculation_runs
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

-- comments: org members can access comments in their org
CREATE POLICY comments_org_access ON comments
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY comments_org_insert ON comments
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY comments_org_update ON comments
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY comments_org_delete ON comments
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- contracts: org members can access their org's contracts
CREATE POLICY contracts_org_access ON contracts
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY contracts_org_insert ON contracts
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY contracts_org_update ON contracts
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY contracts_org_delete ON contracts
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- emission_categories: globally readable (reference data), but org-scoped for custom ones
CREATE POLICY emission_categories_read ON emission_categories
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY emission_categories_org_write ON emission_categories
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY emission_categories_org_update ON emission_categories
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

-- emission_calculations: org members can view their org's calculations
CREATE POLICY emission_calculations_org_access ON emission_calculations
FOR SELECT USING (is_org_member_for_rls(organization_id));

-- evidence_files: org members can access their org's evidence files
CREATE POLICY evidence_files_org_access ON evidence_files
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY evidence_files_org_insert ON evidence_files
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY evidence_files_org_update ON evidence_files
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY evidence_files_org_delete ON evidence_files
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- evidence_classifications: org members can access classifications in their org
CREATE POLICY evidence_classifications_org_access ON evidence_classifications
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY evidence_classifications_org_insert ON evidence_classifications
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

-- facilities: org members can access their org's facilities
CREATE POLICY facilities_org_access ON facilities
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY facilities_org_insert ON facilities
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY facilities_org_update ON facilities
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY facilities_org_delete ON facilities
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- field_submissions: org members can access their org's submissions
CREATE POLICY field_submissions_org_access ON field_submissions
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY field_submissions_org_insert ON field_submissions
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY field_submissions_org_update ON field_submissions
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

-- import_batches: org members can access their org's imports
CREATE POLICY import_batches_org_access ON import_batches
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY import_batches_org_insert ON import_batches
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY import_batches_org_update ON import_batches
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

-- invite_links: org members can access invitation links in their org
CREATE POLICY invite_links_org_access ON invite_links
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY invite_links_org_insert ON invite_links
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

-- organization_membership: users can see membership records for orgs they belong to
CREATE POLICY organization_membership_view ON organization_membership
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY organization_membership_admin ON organization_membership
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY organization_membership_admin_update ON organization_membership
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY organization_membership_admin_delete ON organization_membership
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- ocr_corrections: org members can access OCR corrections in their org
CREATE POLICY ocr_corrections_org_access ON ocr_corrections
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY ocr_corrections_org_insert ON ocr_corrections
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY ocr_corrections_org_update ON ocr_corrections
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

-- published_snapshots: org members can access their org's snapshots
CREATE POLICY published_snapshots_org_access ON published_snapshots
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY published_snapshots_org_insert ON published_snapshots
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

-- reports: org members can access their org's reports
CREATE POLICY reports_org_access ON reports
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY reports_org_insert ON reports
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY reports_org_update ON reports
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

-- review_tasks: org members can access review tasks in their org
CREATE POLICY review_tasks_org_access ON review_tasks
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY review_tasks_org_insert ON review_tasks
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY review_tasks_org_update ON review_tasks
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

-- staged_activity_records: org members can access their org's staged records
CREATE POLICY staged_activity_records_org_access ON staged_activity_records
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY staged_activity_records_org_insert ON staged_activity_records
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY staged_activity_records_org_update ON staged_activity_records
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY staged_activity_records_org_delete ON staged_activity_records
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- ============================================================================
-- REFERENCE/SYSTEM TABLES (publicly readable, org-scoped writes)
-- ============================================================================

-- business_units: org members can access their org's business units
CREATE POLICY business_units_org_access ON business_units
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY business_units_org_insert ON business_units
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY business_units_org_update ON business_units
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

-- methodology_versions: globally readable reference data
CREATE POLICY methodology_versions_read ON methodology_versions
FOR SELECT USING (true);

-- factor_libraries: globally readable reference data
CREATE POLICY factor_libraries_read ON factor_libraries
FOR SELECT USING (true);

-- emission_factors: globally readable reference data
CREATE POLICY emission_factors_read ON emission_factors
FOR SELECT USING (true);

-- reporting_periods: org members can access their org's periods
CREATE POLICY reporting_periods_org_access ON reporting_periods
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY reporting_periods_org_insert ON reporting_periods
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY reporting_periods_org_update ON reporting_periods
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

-- reduction_initiatives: org members can access their org's initiatives
CREATE POLICY reduction_initiatives_org_access ON reduction_initiatives
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY reduction_initiatives_org_insert ON reduction_initiatives
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY reduction_initiatives_org_update ON reduction_initiatives
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

-- reduction_targets: org members can access their org's targets
CREATE POLICY reduction_targets_org_access ON reduction_targets
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY reduction_targets_org_insert ON reduction_targets
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY reduction_targets_org_update ON reduction_targets
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

-- webhooks: org members can access their org's webhooks
CREATE POLICY webhooks_org_access ON webhooks
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY webhooks_org_insert ON webhooks
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY webhooks_org_update ON webhooks
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY webhooks_org_delete ON webhooks
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- organizations: users can see orgs they're members of
CREATE POLICY organizations_member_access ON organizations
FOR SELECT USING (EXISTS (
  SELECT 1 FROM organization_membership
  WHERE user_id = auth.uid()::text AND organization_id = organizations.id::text
));

-- dashboard_aggregates: org members can view their org's aggregates
CREATE POLICY dashboard_aggregates_org_access ON dashboard_aggregates
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY dashboard_aggregates_org_insert ON dashboard_aggregates
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY dashboard_aggregates_org_update ON dashboard_aggregates
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY dashboard_aggregates_org_delete ON dashboard_aggregates
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- GRANT permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
