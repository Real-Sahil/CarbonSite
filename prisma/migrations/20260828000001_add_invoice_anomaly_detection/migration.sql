-- Add invoice record tracking table for accounting API integrations
CREATE TABLE "invoice_records" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  external_invoice_id VARCHAR(255) NOT NULL,
  source_system VARCHAR(100) NOT NULL,
  vendor_id VARCHAR(255) NOT NULL,
  vendor_name VARCHAR(255) NOT NULL,
  invoice_date TIMESTAMP NOT NULL,
  received_date TIMESTAMP,
  total_amount DECIMAL(15, 2) NOT NULL,
  line_items JSONB,
  reconciliation_status VARCHAR(50) DEFAULT 'unmatched',
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(organization_id, source_system, external_invoice_id),
  FOREIGN KEY (organization_id) REFERENCES "organizations"(id) ON DELETE CASCADE
);

CREATE INDEX idx_invoice_records_org ON "invoice_records"(organization_id);
CREATE INDEX idx_invoice_records_org_source ON "invoice_records"(organization_id, source_system, processed);
CREATE INDEX idx_invoice_records_vendor ON "invoice_records"(organization_id, vendor_id);
CREATE INDEX idx_invoice_records_date ON "invoice_records"(organization_id, invoice_date);

-- Add invoice anomaly detection table
CREATE TABLE "invoice_anomalies" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES "invoice_records"(id) ON DELETE CASCADE,
  anomaly_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  resolution VARCHAR(20),
  resolution_notes TEXT,
  resolved_by_user_id UUID,
  resolved_at TIMESTAMP,
  detected_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (resolved_by_user_id) REFERENCES "users"(id) ON DELETE SET NULL
);

CREATE INDEX idx_invoice_anomalies_invoice ON "invoice_anomalies"(invoice_id);
CREATE INDEX idx_invoice_anomalies_org_severity ON "invoice_anomalies"(severity, detected_at);
CREATE INDEX idx_invoice_anomalies_type ON "invoice_anomalies"(anomaly_type);

-- Add invoice reconciliation detail table
CREATE TABLE "invoice_reconciliations" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES "invoice_records"(id) ON DELETE CASCADE,
  line_item_id VARCHAR(255) NOT NULL,
  quantity_ordered INT,
  quantity_received INT,
  quantity_invoiced INT NOT NULL,
  match_status VARCHAR(50),
  discrepancy_percent DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (invoice_id) REFERENCES "invoice_records"(id) ON DELETE CASCADE
);

CREATE INDEX idx_invoice_reconciliations_invoice ON "invoice_reconciliations"(invoice_id);
CREATE INDEX idx_invoice_reconciliations_status ON "invoice_reconciliations"(match_status);

-- Add integration connection type for accounting software
ALTER TABLE "integration_connections"
ADD COLUMN IF NOT EXISTS webhook_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS webhook_secret_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS api_version VARCHAR(50);
