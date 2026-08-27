-- Enable pgAudit extension for database-level audit trail
-- Note: pgAudit requires superuser privileges. On managed PostgreSQL services (Neon, RDS),
-- this may not be available. Application-level audit logging via AuditLog model is preferred.

-- Create schema for audit logs if not exists
CREATE SCHEMA IF NOT EXISTS audit;

-- Attempt to create pgAudit extension (may fail on managed services, which is OK)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pgaudit;
EXCEPTION WHEN OTHERS THEN
  -- Extension creation failed (expected on managed PostgreSQL services)
  -- Application-level auditing via AuditLog model will be used instead
  NULL;
END $$;
