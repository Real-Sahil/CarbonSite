-- CreateTable
CREATE TABLE "supplier_reports" (
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

-- CreateIndex
CREATE INDEX "supplier_reports_organization_id_status_idx" ON "supplier_reports"("organization_id", "status");

-- CreateIndex
CREATE INDEX "supplier_reports_organization_id_reporting_year_idx" ON "supplier_reports"("organization_id", "reporting_year");

-- CreateIndex
CREATE INDEX "supplier_reports_organization_id_supplier_email_idx" ON "supplier_reports"("organization_id", "supplier_email");

-- CreateIndex
CREATE INDEX "supplier_reports_supplier_data_request_id_idx" ON "supplier_reports"("supplier_data_request_id");

-- AddForeignKey
ALTER TABLE "supplier_reports" ADD CONSTRAINT "supplier_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_reports" ADD CONSTRAINT "supplier_reports_emission_category_id_fkey" FOREIGN KEY ("emission_category_id") REFERENCES "emission_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_reports" ADD CONSTRAINT "supplier_reports_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
