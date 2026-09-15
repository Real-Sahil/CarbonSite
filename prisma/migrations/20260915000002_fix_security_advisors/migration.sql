-- Fix: RLS disabled on ecological_scans (Supabase security advisor ERROR)
ALTER TABLE public.ecological_scans ENABLE ROW LEVEL SECURITY;

-- Fix: pgaudit SECURITY DEFINER functions callable by anon/authenticated (WARN)
REVOKE EXECUTE ON FUNCTION public.pgaudit_ddl_command_end() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pgaudit_sql_drop() FROM anon, authenticated;

-- Fix: pgboss functions with mutable search_path (WARN)
ALTER FUNCTION pgboss.job_table_format(text, text) SET search_path = pgboss, pg_catalog;
ALTER FUNCTION pgboss.job_table_run(text, text, text) SET search_path = pgboss, pg_catalog;
ALTER FUNCTION pgboss.job_table_run_async(text, integer, text, text, text) SET search_path = pgboss, pg_catalog;
ALTER FUNCTION pgboss.create_queue(text, jsonb) SET search_path = pgboss, pg_catalog;
ALTER FUNCTION pgboss.delete_queue(text) SET search_path = pgboss, pg_catalog;
