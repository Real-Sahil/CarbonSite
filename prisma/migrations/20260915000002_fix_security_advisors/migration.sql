-- Fix: RLS disabled on ecological_scans (Supabase security advisor ERROR)
ALTER TABLE public.ecological_scans ENABLE ROW LEVEL SECURITY;

-- Fix: pgaudit SECURITY DEFINER functions callable by anon/authenticated (WARN)
-- Guarded: these functions only exist when pgaudit is installed (Supabase); plain
-- PostgreSQL (CI, local dev) doesn't have them so REVOKE must be conditional.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'pgaudit_ddl_command_end'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.pgaudit_ddl_command_end() FROM anon, authenticated';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'pgaudit_sql_drop'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.pgaudit_sql_drop() FROM anon, authenticated';
  END IF;
END $$;

-- Fix: pgboss functions with mutable search_path (WARN)
-- Guarded: pgboss schema only exists when pg-boss has been initialised
-- (Supabase production). CI uses a fresh DB with no pg-boss schema.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'pgboss') THEN
    EXECUTE 'ALTER FUNCTION pgboss.job_table_format(text, text) SET search_path = pgboss, pg_catalog';
    EXECUTE 'ALTER FUNCTION pgboss.job_table_run(text, text, text) SET search_path = pgboss, pg_catalog';
    EXECUTE 'ALTER FUNCTION pgboss.job_table_run_async(text, integer, text, text, text) SET search_path = pgboss, pg_catalog';
    EXECUTE 'ALTER FUNCTION pgboss.create_queue(text, jsonb) SET search_path = pgboss, pg_catalog';
    EXECUTE 'ALTER FUNCTION pgboss.delete_queue(text) SET search_path = pgboss, pg_catalog';
  END IF;
END $$;
