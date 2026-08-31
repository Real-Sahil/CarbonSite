-- AlterTable
DO $$
BEGIN
  ALTER TABLE "supplier_data_requests"
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "quality_flags" JSONB,
  ADD COLUMN "rejection_reason" TEXT,
  ADD COLUMN "approved_by_user_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "supplier_data_requests" ADD CONSTRAINT "supplier_data_requests_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
