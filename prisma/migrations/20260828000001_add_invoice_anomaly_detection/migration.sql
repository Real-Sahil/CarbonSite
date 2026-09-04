-- Add invoice record tracking table for accounting API integrations
--
-- Rewritten: this migration referenced "Organization"/"User" (Prisma model
-- names) instead of their actual mapped table names "organizations"/"users",
-- so every CREATE TABLE here always failed outright ("relation Organization
-- does not exist"). It also created "InvoiceAnomaly"/"InvoiceReconciliation"
-- as PascalCase table names, which don't match those models' @@map values
-- (invoice_anomalies / invoice_reconciliations) — even had the migration
-- succeeded as originally written, Prisma's client would never have found
-- these tables. invoice_reconciliations was additionally missing the
-- organization_id and unit_price columns the InvoiceReconciliation model
-- requires.
CREATE TABLE IF NOT EXISTS "invoice_records" (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  external_invoice_id TEXT NOT NULL,
  source_system TEXT NOT NULL,
  vendor_id TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  invoice_date TIMESTAMP(3) NOT NULL,
  received_date TIMESTAMP(3),
  due_date TIMESTAMP(3),
  total_amount DECIMAL(15, 2) NOT NULL,
  line_items JSONB NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  notes TEXT,
  scope3_ready_status TEXT NOT NULL DEFAULT 'pending',
  extracted_at TIMESTAMP(3) NOT NULL,
  processed_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "invoice_records_organization_id_source_system_external_invoice_id_key" UNIQUE(organization_id, source_system, external_invoice_id)
);

CREATE INDEX IF NOT EXISTS "invoice_records_organization_id_invoice_date_idx" ON "invoice_records"(organization_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS "invoice_records_organization_id_scope3_ready_status_idx" ON "invoice_records"(organization_id, scope3_ready_status);
CREATE INDEX IF NOT EXISTS "invoice_records_organization_id_vendor_id_idx" ON "invoice_records"(organization_id, vendor_id);

-- Add invoice anomaly detection table
CREATE TABLE IF NOT EXISTS "invoice_anomalies" (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES "invoice_records"(id) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  reason TEXT NOT NULL,
  detected_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolution TEXT,
  resolved_by TEXT REFERENCES "users"(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP(3),
  notes TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "invoice_anomalies_invoice_id_severity_idx" ON "invoice_anomalies"(invoice_id, severity);
CREATE INDEX IF NOT EXISTS "invoice_anomalies_organization_id_resolution_detected_at_idx" ON "invoice_anomalies"(organization_id, resolution, detected_at DESC);
CREATE INDEX IF NOT EXISTS "invoice_anomalies_organization_id_anomaly_type_idx" ON "invoice_anomalies"(organization_id, anomaly_type);

-- Add invoice reconciliation detail table
CREATE TABLE IF NOT EXISTS "invoice_reconciliations" (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES "invoice_records"(id) ON DELETE CASCADE,
  line_item_id TEXT NOT NULL,
  quantity_ordered INT NOT NULL,
  quantity_received INT NOT NULL,
  quantity_invoiced INT NOT NULL,
  unit_price DECIMAL(15, 4) NOT NULL,
  match_status TEXT NOT NULL,
  discrepancy_percent DECIMAL(5, 2),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "invoice_reconciliations_invoice_id_idx" ON "invoice_reconciliations"(invoice_id);
CREATE INDEX IF NOT EXISTS "invoice_reconciliations_organization_id_match_status_idx" ON "invoice_reconciliations"(organization_id, match_status);
