-- Add Airbyte data integration staging tables
--
-- Rewritten: the original version used UUID ids/organization_id (copy-pasted
-- from an illustrative planning doc) referencing organizations(id), which is
-- TEXT (Prisma cuid()) like every other table in this schema — a UUID
-- foreign key can never reference a TEXT primary key, so CREATE TABLE always
-- failed here, despite _prisma_migrations recording this migration as
-- applied and neither table actually existing.

-- StagedExternalData table for storing data synced from external sources via Airbyte
CREATE TABLE IF NOT EXISTS "staged_external_data" (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  source_system VARCHAR(100) NOT NULL,
  source_record_id VARCHAR(255) NOT NULL,
  data_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  extracted_at TIMESTAMP(3) NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, source_system, source_record_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "idx_staged_external_data_org_source_processed"
  ON "staged_external_data"(organization_id, source_system, processed);

CREATE INDEX IF NOT EXISTS "idx_staged_external_data_org_type_processed"
  ON "staged_external_data"(organization_id, data_type, processed);

CREATE INDEX IF NOT EXISTS "idx_staged_external_data_org_created"
  ON "staged_external_data"(organization_id, created_at DESC);

-- AirbyteSyncConnection table for tracking Airbyte connections per organization
CREATE TABLE IF NOT EXISTS "airbyte_sync_connections" (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  source_system VARCHAR(255) NOT NULL,
  airbyte_connection_id VARCHAR(255),
  airbyte_source_id VARCHAR(255),
  airbyte_destination_id VARCHAR(255),
  config JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP(3),
  last_sync_status VARCHAR(50),
  sync_frequency VARCHAR(50) NOT NULL DEFAULT 'daily',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "idx_airbyte_sync_connections_org_system_enabled"
  ON "airbyte_sync_connections"(organization_id, source_system, enabled);

CREATE INDEX IF NOT EXISTS "idx_airbyte_sync_connections_org_created"
  ON "airbyte_sync_connections"(organization_id, created_at DESC);
