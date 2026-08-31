-- Add Airbyte data integration staging tables

-- StagedExternalData table for storing data synced from external sources via Airbyte
CREATE TABLE IF NOT EXISTS "staged_external_data" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  source_system VARCHAR(100) NOT NULL,
  source_record_id VARCHAR(255) NOT NULL,
  data_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  extracted_at TIMESTAMP NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  source_system VARCHAR(255) NOT NULL,
  airbyte_connection_id VARCHAR(255),
  airbyte_source_id VARCHAR(255),
  airbyte_destination_id VARCHAR(255),
  config JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP,
  last_sync_status VARCHAR(50),
  sync_frequency VARCHAR(50) NOT NULL DEFAULT 'daily',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "idx_airbyte_sync_connections_org_system_enabled"
  ON "airbyte_sync_connections"(organization_id, source_system, enabled);

CREATE INDEX IF NOT EXISTS "idx_airbyte_sync_connections_org_created"
  ON "airbyte_sync_connections"(organization_id, created_at DESC);
