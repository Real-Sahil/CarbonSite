-- Supabase security advisor (rls_disabled_in_public, ERROR): these tables
-- shipped without row-level security, and anon/authenticated held SELECT on
-- them, so anyone with the public anon key could read them over PostgREST.
-- Same deny-by-default pattern as 20260904000014: the app connects as
-- `postgres` (BYPASSRLS, table owner, RLS not forced), so it is unaffected,
-- while is_org_member_for_rls() always returns false and blocks PostgREST.

-- Org-scoped tables.
ALTER TABLE "carbon_signals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carbon_signals_org_access" ON "carbon_signals" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "carbon_signals_org_insert" ON "carbon_signals" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "carbon_signals_org_update" ON "carbon_signals" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "carbon_signals_org_delete" ON "carbon_signals" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "discharge_readings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "discharge_readings_org_access" ON "discharge_readings" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "discharge_readings_org_insert" ON "discharge_readings" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "discharge_readings_org_update" ON "discharge_readings" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "discharge_readings_org_delete" ON "discharge_readings" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "enforcement_notices" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enforcement_notices_org_access" ON "enforcement_notices" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "enforcement_notices_org_insert" ON "enforcement_notices" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "enforcement_notices_org_update" ON "enforcement_notices" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "enforcement_notices_org_delete" ON "enforcement_notices" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "evidence_access_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence_access_logs_org_access" ON "evidence_access_logs" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "evidence_access_logs_org_insert" ON "evidence_access_logs" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "evidence_access_logs_org_update" ON "evidence_access_logs" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "evidence_access_logs_org_delete" ON "evidence_access_logs" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "external_api_credentials" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "external_api_credentials_org_access" ON "external_api_credentials" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "external_api_credentials_org_insert" ON "external_api_credentials" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "external_api_credentials_org_update" ON "external_api_credentials" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "external_api_credentials_org_delete" ON "external_api_credentials" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "geographic_impacts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "geographic_impacts_org_access" ON "geographic_impacts" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "geographic_impacts_org_insert" ON "geographic_impacts" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "geographic_impacts_org_update" ON "geographic_impacts" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "geographic_impacts_org_delete" ON "geographic_impacts" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "hs_incident_reports" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hs_incident_reports_org_access" ON "hs_incident_reports" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "hs_incident_reports_org_insert" ON "hs_incident_reports" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "hs_incident_reports_org_update" ON "hs_incident_reports" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "hs_incident_reports_org_delete" ON "hs_incident_reports" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "impact_alerts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "impact_alerts_org_access" ON "impact_alerts" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "impact_alerts_org_insert" ON "impact_alerts" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "impact_alerts_org_update" ON "impact_alerts" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "impact_alerts_org_delete" ON "impact_alerts" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "materiality_assessments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materiality_assessments_org_access" ON "materiality_assessments" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "materiality_assessments_org_insert" ON "materiality_assessments" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "materiality_assessments_org_update" ON "materiality_assessments" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "materiality_assessments_org_delete" ON "materiality_assessments" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "materiality_topics" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materiality_topics_org_access" ON "materiality_topics" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "materiality_topics_org_insert" ON "materiality_topics" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "materiality_topics_org_update" ON "materiality_topics" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "materiality_topics_org_delete" ON "materiality_topics" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "method_statements" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "method_statements_org_access" ON "method_statements" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "method_statements_org_insert" ON "method_statements" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "method_statements_org_update" ON "method_statements" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "method_statements_org_delete" ON "method_statements" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "programmes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "programmes_org_access" ON "programmes" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "programmes_org_insert" ON "programmes" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "programmes_org_update" ON "programmes" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "programmes_org_delete" ON "programmes" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "supplier_profiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_profiles_org_access" ON "supplier_profiles" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "supplier_profiles_org_insert" ON "supplier_profiles" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "supplier_profiles_org_update" ON "supplier_profiles" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "supplier_profiles_org_delete" ON "supplier_profiles" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "sv_activities" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sv_activities_org_access" ON "sv_activities" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "sv_activities_org_insert" ON "sv_activities" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "sv_activities_org_update" ON "sv_activities" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "sv_activities_org_delete" ON "sv_activities" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "sv_commitments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sv_commitments_org_access" ON "sv_commitments" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "sv_commitments_org_insert" ON "sv_commitments" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "sv_commitments_org_update" ON "sv_commitments" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "sv_commitments_org_delete" ON "sv_commitments" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "sv_frameworks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sv_frameworks_org_access" ON "sv_frameworks" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "sv_frameworks_org_insert" ON "sv_frameworks" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "sv_frameworks_org_update" ON "sv_frameworks" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "sv_frameworks_org_delete" ON "sv_frameworks" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "tnfd_scenarios" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tnfd_scenarios_org_access" ON "tnfd_scenarios" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "tnfd_scenarios_org_insert" ON "tnfd_scenarios" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "tnfd_scenarios_org_update" ON "tnfd_scenarios" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "tnfd_scenarios_org_delete" ON "tnfd_scenarios" FOR DELETE USING (is_org_member_for_rls(organization_id));

ALTER TABLE "worker_sessions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "worker_sessions_org_access" ON "worker_sessions" FOR SELECT USING (is_org_member_for_rls(organization_id));
CREATE POLICY "worker_sessions_org_insert" ON "worker_sessions" FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "worker_sessions_org_update" ON "worker_sessions" FOR UPDATE USING (is_org_member_for_rls(organization_id)) WITH CHECK (is_org_member_for_rls(organization_id));
CREATE POLICY "worker_sessions_org_delete" ON "worker_sessions" FOR DELETE USING (is_org_member_for_rls(organization_id));

-- Child tables of the SV framework with no organization_id of their own.
ALTER TABLE "sv_indicators" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sv_indicators_deny_all" ON "sv_indicators" FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE "sv_measures" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sv_measures_deny_all" ON "sv_measures" FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE "sv_outcomes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sv_outcomes_deny_all" ON "sv_outcomes" FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE "sv_themes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sv_themes_deny_all" ON "sv_themes" FOR ALL USING (false) WITH CHECK (false);
