-- Add RLS policies for Phase 5 Analytics tables
-- Defense-in-depth: application enforces org scoping via requireOrgMember()
-- Database-level RLS provides additional protection against SQL injection / auth bypass

-- ============================================================================
-- emissions_forecasts: org members can access their org's forecasts
-- ============================================================================

CREATE POLICY emissions_forecasts_org_select ON emissions_forecasts
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY emissions_forecasts_org_insert ON emissions_forecasts
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY emissions_forecasts_org_update ON emissions_forecasts
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY emissions_forecasts_org_delete ON emissions_forecasts
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- ============================================================================
-- model_explanations: org members can access explanations in their org
-- ============================================================================

CREATE POLICY model_explanations_org_select ON model_explanations
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY model_explanations_org_insert ON model_explanations
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY model_explanations_org_update ON model_explanations
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY model_explanations_org_delete ON model_explanations
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- ============================================================================
-- causal_analyses: org members can access causal analyses in their org
-- ============================================================================

CREATE POLICY causal_analyses_org_select ON causal_analyses
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY causal_analyses_org_insert ON causal_analyses
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY causal_analyses_org_update ON causal_analyses
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY causal_analyses_org_delete ON causal_analyses
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- ============================================================================
-- batch_jobs: org members can access batch jobs in their org
-- ============================================================================

CREATE POLICY batch_jobs_org_select ON batch_jobs
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY batch_jobs_org_insert ON batch_jobs
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY batch_jobs_org_update ON batch_jobs
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY batch_jobs_org_delete ON batch_jobs
FOR DELETE USING (is_org_member_for_rls(organization_id));

-- ============================================================================
-- analytics_dashboard_cache: org members can access dashboard cache in their org
-- ============================================================================

CREATE POLICY analytics_dashboard_cache_org_select ON analytics_dashboard_cache
FOR SELECT USING (is_org_member_for_rls(organization_id));

CREATE POLICY analytics_dashboard_cache_org_insert ON analytics_dashboard_cache
FOR INSERT WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY analytics_dashboard_cache_org_update ON analytics_dashboard_cache
FOR UPDATE USING (is_org_member_for_rls(organization_id))
WITH CHECK (is_org_member_for_rls(organization_id));

CREATE POLICY analytics_dashboard_cache_org_delete ON analytics_dashboard_cache
FOR DELETE USING (is_org_member_for_rls(organization_id));
