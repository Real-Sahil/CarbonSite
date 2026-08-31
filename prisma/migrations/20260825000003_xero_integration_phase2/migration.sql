-- Add fields to support Xero Integration Phase 2
DO $$
BEGIN
  ALTER TABLE "integration_connections"
  ADD COLUMN "token_type" TEXT,
  ADD COLUMN "external_tenant_id" TEXT,
  ADD COLUMN "metadata" JSONB;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Create index on external_tenant_id for webhook lookups
CREATE INDEX IF NOT EXISTS "integration_connections_external_tenant_id_idx" ON "integration_connections"("external_tenant_id");
