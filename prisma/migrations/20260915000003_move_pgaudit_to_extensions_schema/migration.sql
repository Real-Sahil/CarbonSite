-- Fix: pgaudit extension installed in public schema (WARN: extension_in_public)
-- Move it to extensions schema so it is not exposed via the Supabase Data API.

CREATE SCHEMA IF NOT EXISTS extensions;
REVOKE ALL ON SCHEMA extensions FROM PUBLIC;

-- Drop from public (removes pgaudit_ddl_command_end/pgaudit_sql_drop from public)
DROP EXTENSION IF EXISTS pgaudit;

-- Reinstall in non-exposed schema
CREATE EXTENSION pgaudit SCHEMA extensions;
