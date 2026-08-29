-- Add invoice record tracking table for accounting API integrations
CREATE TABLE "invoice_records" (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  external_invoice_id TEXT NOT NULL,
  source_system TEXT NOT NULL,
  vendor_id TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  invoice_date TIMESTAMP(3) NOT NULL,
  received_date TIMESTAMP(3),
  due_date TIMESTAMP(3),
  total_amount DECIMAL(15, 2) NOT NULL,
  line_items JSONB,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  notes TEXT,
  scope3_ready_status TEXT NOT NULL DEFAULT 'pending',
  extracted_at TIMESTAMP(3) NOT NULL,
  processed_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InvoiceRecord_organizationId_sourceSystem_externalInvoiceId_key" UNIQUE(organization_id, source_system, external_invoice_id)
);

CREATE INDEX "InvoiceRecord_organizationId_invoiceDate_idx" ON "invoice_records"(organization_id DESC, invoice_date DESC);
CREATE INDEX "InvoiceRecord_organizationId_scope3ReadyStatus_idx" ON "invoice_records"(organization_id, scope3_ready_status);
CREATE INDEX "InvoiceRecord_organizationId_vendorId_idx" ON "invoice_records"(organization_id, vendor_id);

-- Add invoice anomaly detection table
CREATE TABLE "InvoiceAnomaly" (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES "invoice_records"(id) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  reason TEXT NOT NULL,
  detected_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolution TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMP(3),
  notes TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InvoiceAnomaly_invoiceId_severity_idx" FOREIGN KEY (invoice_id) REFERENCES "invoice_records"(id) ON DELETE CASCADE,
  CONSTRAINT "InvoiceAnomaly_resolved_by_fkey" FOREIGN KEY (resolved_by) REFERENCES "User"(id) ON DELETE SET NULL
);

CREATE INDEX "InvoiceAnomaly_invoiceId_severity_idx" ON "InvoiceAnomaly"(invoice_id, severity);
CREATE INDEX "InvoiceAnomaly_organizationId_resolution_detectedAt_idx" ON "InvoiceAnomaly"(organization_id, resolution, detected_at DESC);
CREATE INDEX "InvoiceAnomaly_organizationId_anomalyType_idx" ON "InvoiceAnomaly"(organization_id, anomaly_type);

-- Add invoice reconciliation detail table
CREATE TABLE "InvoiceReconciliation" (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES "invoice_records"(id) ON DELETE CASCADE,
  line_item_id TEXT NOT NULL,
  quantity_ordered INT,
  quantity_received INT,
  quantity_invoiced INT NOT NULL,
  match_status TEXT,
  discrepancy_percent DECIMAL(5, 2),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "InvoiceReconciliation_invoiceId_idx" ON "InvoiceReconciliation"(invoice_id);
CREATE INDEX "InvoiceReconciliation_matchStatus_idx" ON "InvoiceReconciliation"(match_status);
