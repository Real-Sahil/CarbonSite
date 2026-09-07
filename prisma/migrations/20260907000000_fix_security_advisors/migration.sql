-- Enable RLS on tables that were missing it
ALTER TABLE public.water_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environmental_metric_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xero_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Org-scoped access policies (PostgREST layer; app enforces RBAC independently)
CREATE POLICY "org_members_water_records"
  ON public.water_records
  USING (is_org_member_for_rls(organization_id));

CREATE POLICY "org_members_environmental_metric_aggregates"
  ON public.environmental_metric_aggregates
  USING (is_org_member_for_rls(organization_id));

CREATE POLICY "org_members_xero_sync_logs"
  ON public.xero_sync_logs
  USING (is_org_member_for_rls(organization_id));

CREATE POLICY "org_members_onboarding_progress"
  ON public.onboarding_progress
  USING (is_org_member_for_rls(organization_id));

-- Fix is_org_member_for_rls mutable search_path warning
CREATE OR REPLACE FUNCTION public.is_org_member_for_rls(org_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT false;
$$;

-- Revoke pgaudit event trigger functions from anon/authenticated roles
-- (internal C functions that must not be callable via PostgREST; conditional
--  because pgaudit may not be installed in all environments, e.g. CI postgres)
DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.pgaudit_ddl_command_end() FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.pgaudit_sql_drop() FROM anon, authenticated;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;
