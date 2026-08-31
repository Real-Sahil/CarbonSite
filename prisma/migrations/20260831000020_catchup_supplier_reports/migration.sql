-- Catch-up migration: create supplier_reports table which was previously marked
-- as applied by reset-migrations.ts without actually running the SQL.
-- Creates table and indexes only; FKs are deferred to a separate migration once table exists.

CREATE TABLE IF NOT EXISTS "supplier_reports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "supplier_data_request_id" TEXT,
    "supplier_email" TEXT NOT NULL,
    "supplier_name" TEXT,
    "supplier_domain" TEXT,
    "emission_category_id" TEXT NOT NULL,
    "reporting_year" INTEGER NOT NULL,
    "total_amount" DECIMAL(18,6) NOT NULL,
    "unit" TEXT NOT NULL,
    "calculation_method" TEXT NOT NULL,
    "notes" TEXT,
    "supporting_file_keys" TEXT[],
    "quality_score" INTEGER,
    "quality_flags" JSONB,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "converted_to_record_id" TEXT,
    "converted_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "supplier_reports_organization_id_status_idx" ON "supplier_reports"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "supplier_reports_organization_id_reporting_year_idx" ON "supplier_reports"("organization_id", "reporting_year");
CREATE INDEX IF NOT EXISTS "supplier_reports_organization_id_supplier_email_idx" ON "supplier_reports"("organization_id", "supplier_email");
CREATE INDEX IF NOT EXISTS "supplier_reports_supplier_data_request_id_idx" ON "supplier_reports"("supplier_data_request_id");
