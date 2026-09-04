-- Create airbite_connectors table (per-org Airbyte source connectors)
CREATE TABLE IF NOT EXISTS "airbite_connectors" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "source_system" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sync_schedule" TEXT,
    "config" JSONB NOT NULL,
    "records_synced" INTEGER NOT NULL DEFAULT 0,
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" TEXT,
    "last_sync_error" TEXT,
    "next_scheduled_at" TIMESTAMP(3),
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_failure_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airbite_connectors_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "airbite_connectors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
    CONSTRAINT "airbite_connectors_organization_id_source_system_key" UNIQUE ("organization_id", "source_system")
);

CREATE INDEX IF NOT EXISTS "airbite_connectors_organization_id_enabled_idx" ON "airbite_connectors"("organization_id", "enabled");
CREATE INDEX IF NOT EXISTS "airbite_connectors_organization_id_last_sync_at_idx" ON "airbite_connectors"("organization_id", "last_sync_at" DESC);

-- Create airbyte_sync_logs table (per-run sync history for airbite_connectors)
CREATE TABLE IF NOT EXISTS "airbyte_sync_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "records_read" INTEGER NOT NULL DEFAULT 0,
    "records_written" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "duration" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "airbyte_sync_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "airbyte_sync_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
    CONSTRAINT "airbyte_sync_logs_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "airbite_connectors"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "airbyte_sync_logs_organization_id_connector_id_idx" ON "airbyte_sync_logs"("organization_id", "connector_id");
CREATE INDEX IF NOT EXISTS "airbyte_sync_logs_connector_id_status_started_at_idx" ON "airbyte_sync_logs"("connector_id", "status", "started_at" DESC);
