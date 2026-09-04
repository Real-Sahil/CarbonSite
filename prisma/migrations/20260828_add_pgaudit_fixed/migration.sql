-- Enable pgAudit extension for database-level audit trail (best-effort).
-- Logs all INSERT/UPDATE/DELETE on critical tables to audit.log_table where
-- the extension is available (e.g. Supabase). No application code reads or
-- writes through pgaudit's own logging today; the real, load-bearing audit
-- trail is writeAuditLog()/AuditLog (lib/db/audit.ts) documented in
-- CLAUDE.md. This extension and the audit_events table below are additive,
-- not required by any code path — so a Postgres instance that doesn't ship
-- pgaudit (a vanilla postgres:16 image, local dev, CI) must not fail this
-- migration over it.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pgaudit;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgaudit extension unavailable on this Postgres instance; skipping. audit_events below does not depend on it.';
END $$;

-- Create schema for audit logs if not exists
CREATE SCHEMA IF NOT EXISTS audit;

-- Create audit log table to store application-level audit events
--
-- Rewritten: the original version used UUID ids/organization_id (copy-pasted
-- from an illustrative planning doc) referencing organizations(id), which is
-- TEXT (Prisma cuid()) like every other table in this schema — a UUID
-- foreign key can never reference a TEXT primary key, so CREATE TABLE always
-- failed here, despite _prisma_migrations recording this migration as
-- applied.
CREATE TABLE IF NOT EXISTS "audit_events" (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  actor_id VARCHAR(255),
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  record_id VARCHAR(255),
  old_values JSONB,
  new_values JSONB,
  timestamp TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_events_organization_timestamp
  ON "audit_events"(organization_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_organization_action
  ON "audit_events"(organization_id, action);

CREATE INDEX IF NOT EXISTS idx_audit_events_organization_table
  ON "audit_events"(organization_id, table_name);

CREATE INDEX IF NOT EXISTS idx_audit_events_record_id
  ON "audit_events"(organization_id, table_name, record_id);
