-- Create invoice_records table for Scope 3 spend tracking
CREATE TABLE IF NOT EXISTS "invoice_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "external_invoice_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "received_date" TIMESTAMP(3),
    "total_amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "line_items" JSONB NOT NULL,
    "source_system" TEXT NOT NULL,
    "source_record_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invoice_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
    CONSTRAINT "invoice_records_organization_id_source_system_source_record_id_key" UNIQUE ("organization_id", "source_system", "source_record_id")
);

-- Create indexes for invoice_records
CREATE INDEX IF NOT EXISTS "invoice_records_organization_id_invoice_date_idx" ON "invoice_records"("organization_id", "invoice_date");
CREATE INDEX IF NOT EXISTS "invoice_records_organization_id_status_idx" ON "invoice_records"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "invoice_records_organization_id_vendor_id_idx" ON "invoice_records"("organization_id", "vendor_id");

-- Create invoice_anomalies table for detected issues
CREATE TABLE IF NOT EXISTS "invoice_anomalies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "anomaly_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolution" TEXT,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_anomalies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invoice_anomalies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
    CONSTRAINT "invoice_anomalies_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice_records"("id") ON DELETE CASCADE
);

-- Create indexes for invoice_anomalies
CREATE INDEX IF NOT EXISTS "invoice_anomalies_invoice_id_severity_idx" ON "invoice_anomalies"("invoice_id", "severity");
CREATE INDEX IF NOT EXISTS "invoice_anomalies_organization_id_anomaly_type_resolution_idx" ON "invoice_anomalies"("organization_id", "anomaly_type", "resolution");
CREATE INDEX IF NOT EXISTS "invoice_anomalies_organization_id_created_at_idx" ON "invoice_anomalies"("organization_id", "created_at" DESC);

-- Update invoice_reconciliations table to add organizationId if not exists
DO $$
BEGIN
  ALTER TABLE "invoice_reconciliations" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add foreign key constraint for organization_id if not exists
DO $$
BEGIN
  ALTER TABLE "invoice_reconciliations" ADD CONSTRAINT "invoice_reconciliations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add index on organization_id and match_status if not exists
CREATE INDEX IF NOT EXISTS "invoice_reconciliations_organization_id_match_status_idx" ON "invoice_reconciliations"("organization_id", "match_status");
