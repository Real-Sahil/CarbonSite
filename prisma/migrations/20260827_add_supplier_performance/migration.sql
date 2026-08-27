-- Add supplier performance tracking table
CREATE TABLE "supplier_performance" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL,
  submission_count INT NOT NULL DEFAULT 0,
  approved_count INT NOT NULL DEFAULT 0,
  rejected_count INT NOT NULL DEFAULT 0,
  on_time_count INT NOT NULL DEFAULT 0,
  completeness_score DECIMAL(5, 2),
  data_quality_score DECIMAL(5, 2),
  last_data_quality_trend VARCHAR(50),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(organization_id, supplier_id),
  FOREIGN KEY (supplier_id) REFERENCES "organizations"(id) ON DELETE CASCADE
);

CREATE INDEX idx_supplier_performance_org ON "supplier_performance"(organization_id);
CREATE INDEX idx_supplier_performance_org_supplier ON "supplier_performance"(organization_id, supplier_id);

-- Add submission deadline tracking to field submissions
ALTER TABLE "field_submissions"
ADD COLUMN IF NOT EXISTS requested_by_deadline TIMESTAMP,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;

-- Create index for on-time tracking
CREATE INDEX IF NOT EXISTS idx_field_submissions_deadline ON "field_submissions"(organization_id, requested_by_deadline, submitted_at);
