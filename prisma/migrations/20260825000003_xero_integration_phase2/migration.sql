-- Add fields to support Xero Integration Phase 2
ALTER TABLE "integration_connections"
ADD COLUMN "token_type" TEXT,
ADD COLUMN "external_tenant_id" TEXT,
ADD COLUMN "metadata" JSONB;

-- Create index on external_tenant_id for webhook lookups
CREATE INDEX "integration_connections_external_tenant_id_idx" ON "integration_connections"("external_tenant_id");
