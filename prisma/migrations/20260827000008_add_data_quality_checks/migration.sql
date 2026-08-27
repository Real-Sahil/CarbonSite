-- Phase 1B: Data Quality Validation via Soda Core
-- Creates table for storing data quality check results

CREATE TABLE IF NOT EXISTS "data_quality_checks" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  import_batch_id UUID REFERENCES "import_batches"(id) ON DELETE CASCADE,
  check_type VARCHAR(100) NOT NULL,
  check_name VARCHAR(255) NOT NULL,
  passed BOOLEAN NOT NULL,
  failures_count INT DEFAULT 0,
  failure_samples JSONB,
  quality_score DECIMAL(5,2) CHECK (quality_score >= 0 AND quality_score <= 100),
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_data_quality_org_batch
  ON "data_quality_checks"(organization_id, import_batch_id);

CREATE INDEX IF NOT EXISTS idx_data_quality_org_type
  ON "data_quality_checks"(organization_id, check_type);

CREATE INDEX IF NOT EXISTS idx_data_quality_org_created
  ON "data_quality_checks"(organization_id, created_at DESC);

-- Add composite quality score per batch
CREATE TABLE IF NOT EXISTS "import_batch_quality_scores" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  import_batch_id UUID NOT NULL UNIQUE REFERENCES "import_batches"(id) ON DELETE CASCADE,
  overall_score DECIMAL(5,2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  checks_passed INT NOT NULL,
  checks_total INT NOT NULL,
  can_commit BOOLEAN NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_quality_org_created
  ON "import_batch_quality_scores"(organization_id, created_at DESC);
