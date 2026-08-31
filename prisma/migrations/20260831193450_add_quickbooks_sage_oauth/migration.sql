-- Add QuickBooks OAuth fields to integration_configs table
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS quickbooks_client_id VARCHAR(255);
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS quickbooks_client_secret VARCHAR(1024);
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS quickbooks_connected BOOLEAN DEFAULT false;
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS quickbooks_connected_at TIMESTAMP;
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS quickbooks_realm_id VARCHAR(255);
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS quickbooks_refresh_token TEXT;
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS quickbooks_token_expires_at TIMESTAMP;

-- Add Sage OAuth fields to integration_configs table
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS sage_client_id VARCHAR(255);
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS sage_client_secret VARCHAR(1024);
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS sage_connected BOOLEAN DEFAULT false;
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS sage_connected_at TIMESTAMP;
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS sage_tenant_id VARCHAR(255);
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS sage_refresh_token TEXT;
ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS sage_token_expires_at TIMESTAMP;
