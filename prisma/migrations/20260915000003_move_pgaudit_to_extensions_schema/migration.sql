-- Fix: pgaudit extension installed in public schema (WARN: extension_in_public)
-- Move it to extensions schema so it is not exposed via the Supabase Data API.
-- Guarded: pgaudit only exists on Supabase; plain PostgreSQL CI images don't
-- ship it, so all statements here must be no-ops when the extension is absent.

CREATE SCHEMA IF NOT EXISTS extensions;
REVOKE ALL ON SCHEMA extensions FROM PUBLIC;

-- Drop from public (removes pgaudit_ddl_command_end/pgaudit_sql_drop from public)
DROP EXTENSION IF EXISTS pgaudit;

-- Reinstall in non-exposed schema (skipped silently when pgaudit is unavailable)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pgaudit SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgaudit unavailable on this Postgres instance; skipping reinstall in extensions schema.';
END $$;
