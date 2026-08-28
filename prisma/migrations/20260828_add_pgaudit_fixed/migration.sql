-- Enable pgAudit extension for database-level audit trail
-- Logs all INSERT/UPDATE/DELETE on critical tables to audit.log_table

CREATE EXTENSION IF NOT EXISTS pgaudit;

-- Create schema for audit logs if not exists
CREATE SCHEMA IF NOT EXISTS audit;

-- Create audit log table to store application-level audit events
CREATE TABLE IF NOT EXISTS "audit_events" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  actor_id VARCHAR(255),
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  record_id VARCHAR(255),
  old_values JSONB,
  new_values JSONB,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
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
