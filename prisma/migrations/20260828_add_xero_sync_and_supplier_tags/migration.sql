-- Add tags field to supplier_invites for category assignment
ALTER TABLE "supplier_invites" ADD COLUMN "tags" JSONB DEFAULT '[]'::jsonb;

-- Create xero_sync_logs table for tracking processed invoices
CREATE TABLE "xero_sync_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "line_item_index" INTEGER NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "line_description" TEXT NOT NULL,
    "amount" NUMERIC(18,6) NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processed',
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "xero_sync_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE
);

-- Create unique index to prevent duplicate processing of same invoice line item
CREATE UNIQUE INDEX "xero_sync_logs_organizationId_invoiceId_lineItemIndex_key" ON "xero_sync_logs"("organization_id", "invoice_id", "line_item_index");

-- Create index for querying recent syncs by org and date
CREATE INDEX "xero_sync_logs_organizationId_processedAt_idx" ON "xero_sync_logs"("organization_id", "processed_at");
