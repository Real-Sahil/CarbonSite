-- Add supplier performance tracking table
--
-- Rewritten: the original version used UUID ids/organization_id/supplier_id
-- (copy-pasted from an illustrative planning doc) referencing
-- organizations(id), which is TEXT (Prisma cuid()) like every other table in
-- this schema — a UUID foreign key can never reference a TEXT primary key,
-- so CREATE TABLE always failed here. updated_at/created_at are also
-- corrected to NOT NULL to match the SupplierPerformance Prisma model.
CREATE TABLE IF NOT EXISTS "supplier_performance" (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  supplier_id TEXT NOT NULL,
  submission_count INT NOT NULL DEFAULT 0,
  approved_count INT NOT NULL DEFAULT 0,
  rejected_count INT NOT NULL DEFAULT 0,
  on_time_count INT NOT NULL DEFAULT 0,
  completeness_score DECIMAL(5, 2),
  data_quality_score DECIMAL(5, 2),
  last_data_quality_trend VARCHAR(50),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(organization_id, supplier_id),
  FOREIGN KEY (supplier_id) REFERENCES "organizations"(id) ON DELETE CASCADE
);

CREATE INDEX idx_supplier_performance_org ON "supplier_performance"(organization_id);
CREATE INDEX idx_supplier_performance_org_supplier ON "supplier_performance"(organization_id, supplier_id);

-- Add submission deadline tracking to field submissions
DO $$
BEGIN
  ALTER TABLE "field_submissions"
  ADD COLUMN IF NOT EXISTS requested_by_deadline TIMESTAMP,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Create index for on-time tracking
CREATE INDEX IF NOT EXISTS idx_field_submissions_deadline ON "field_submissions"(organization_id, requested_by_deadline, submitted_at);
