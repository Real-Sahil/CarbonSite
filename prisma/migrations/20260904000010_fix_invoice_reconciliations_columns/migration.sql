-- Defensive fix for invoice_reconciliations on any environment where the
-- table pre-dates 20260828000001_add_invoice_anomaly_detection's rewrite.
--
-- That migration's CREATE TABLE IF NOT EXISTS silently no-ops on an
-- environment where invoice_reconciliations already existed (e.g. production,
-- from a source that predates this repo's migration history) — leaving it
-- missing organization_id/unit_price entirely and quantity_ordered/
-- quantity_received/match_status nullable, none of which match the
-- InvoiceReconciliation Prisma model. On a genuinely fresh database this is
-- a no-op (the table is created correctly the first time).
ALTER TABLE "invoice_reconciliations"
  ADD COLUMN IF NOT EXISTS "organization_id" TEXT,
  ADD COLUMN IF NOT EXISTS "unit_price" DECIMAL(15, 4);

UPDATE "invoice_reconciliations" SET unit_price = 0 WHERE unit_price IS NULL;
UPDATE "invoice_reconciliations" SET match_status = 'unreconciled' WHERE match_status IS NULL;
UPDATE "invoice_reconciliations" SET quantity_ordered = 0 WHERE quantity_ordered IS NULL;
UPDATE "invoice_reconciliations" SET quantity_received = 0 WHERE quantity_received IS NULL;

DO $$
BEGIN
  ALTER TABLE "invoice_reconciliations"
    ALTER COLUMN "organization_id" SET NOT NULL,
    ALTER COLUMN "unit_price" SET NOT NULL,
    ALTER COLUMN "match_status" SET NOT NULL,
    ALTER COLUMN "quantity_ordered" SET NOT NULL,
    ALTER COLUMN "quantity_received" SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "invoice_reconciliations" ADD CONSTRAINT "invoice_reconciliations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "invoice_reconciliations_organization_id_match_status_idx" ON "invoice_reconciliations"("organization_id", "match_status");
