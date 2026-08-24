ALTER TABLE "supplier_data_requests"
    ADD COLUMN IF NOT EXISTS "submitted_data" JSONB;
