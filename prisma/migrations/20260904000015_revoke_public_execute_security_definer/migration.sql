-- Follow-up to 20260904000014: the REVOKE ... FROM anon, authenticated there
-- didn't fully close the advisor finding, because Postgres grants EXECUTE to
-- the PUBLIC pseudo-role by default on function creation. Since anon and
-- authenticated inherit through that standing PUBLIC grant, revoking only
-- from the two named roles left them able to execute via PUBLIC. Confirmed
-- via Supabase's security advisor still flagging all four functions after
-- the previous migration, then verified directly with
-- has_function_privilege('anon'|'authenticated'|'public', ..., 'EXECUTE').
--
-- Revoking from PUBLIC closes this for the two app-owned functions
-- (is_org_member, is_org_member_for_rls) -- confirmed clear on
-- re-running the advisor. It does NOT close it for pgaudit_ddl_command_end
-- and pgaudit_sql_drop: those are owned by supabase_admin (the extension's
-- installing role), and REVOKE requires object ownership or superuser --
-- the app's own `postgres` role has neither over an extension-owned
-- function, so Postgres emits a WARNING and silently revokes nothing. This
-- matches the already-documented "pgaudit is best-effort, not load-bearing"
-- stance in 20260828_add_pgaudit_fixed; those two remain open at the
-- database-privilege level and are not fixable from application-owned
-- migrations.
--
-- Guarded (WHEN OTHERS) for the same reason as 20260904000014: none of
-- these functions/roles exist on a vanilla local/CI Postgres instance.
DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.is_org_member(text) FROM PUBLIC;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping revoke on public.is_org_member(text): % (expected on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.is_org_member_for_rls(text) FROM PUBLIC;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping revoke on public.is_org_member_for_rls(text): % (expected on non-Supabase Postgres, e.g. local dev/CI)', SQLERRM;
END $$;

-- Best-effort only (see comment above): will no-op with a WARNING against
-- production since postgres does not own these supabase_admin-owned
-- functions, and will no-op via the exception handler everywhere else.
DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.pgaudit_ddl_command_end() FROM PUBLIC;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping revoke on public.pgaudit_ddl_command_end(): % (expected when pgaudit/Supabase roles are unavailable, e.g. local dev/CI)', SQLERRM;
END $$;

DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.pgaudit_sql_drop() FROM PUBLIC;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping revoke on public.pgaudit_sql_drop(): % (expected when pgaudit/Supabase roles are unavailable, e.g. local dev/CI)', SQLERRM;
END $$;
