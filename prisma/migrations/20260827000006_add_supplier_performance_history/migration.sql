-- Add supplier performance history table for trend tracking
CREATE TABLE IF NOT EXISTS "supplier_performance_history" (
  id VARCHAR(191) PRIMARY KEY,
  supplier_performance_id VARCHAR(191) NOT NULL,
  organization_id VARCHAR(191) NOT NULL,
  completeness_score DECIMAL(5,2) NOT NULL,
  data_quality_score DECIMAL(5,2) NOT NULL,
  submission_count INT NOT NULL,
  approved_count INT NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (supplier_performance_id) REFERENCES "supplier_performance"(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES "organizations"(id) ON DELETE CASCADE
);

-- Create indexes for efficient trend queries
CREATE INDEX IF NOT EXISTS "idx_supplier_performance_history_supplier" ON "supplier_performance_history"(supplier_performance_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS "idx_supplier_performance_history_organization" ON "supplier_performance_history"(organization_id, recorded_at DESC);

-- Add submission tracking columns to field_submissions if not already present
DO $$
BEGIN
  ALTER TABLE "field_submissions"
  ADD COLUMN IF NOT EXISTS requested_by_deadline TIMESTAMP,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Create index for on-time tracking
CREATE INDEX IF NOT EXISTS "idx_field_submissions_deadline" ON "field_submissions"(organization_id, requested_by_deadline, submitted_at);
