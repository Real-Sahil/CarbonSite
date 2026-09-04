-- Phase 1B: Data Quality Validation via Soda Core
-- Creates table for storing data quality check results
--
-- Rewritten: the original version used UUID ids/foreign keys
-- (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID
-- REFERENCES organizations(id)) copy-pasted from an illustrative planning
-- doc, but organizations.id and import_batches.id are TEXT (Prisma cuid()),
-- like every other table in this schema. A UUID-typed foreign key column
-- can never reference a TEXT primary key in Postgres — CREATE TABLE fails
-- outright with "incompatible types: uuid and text", so this table has
-- never actually existed anywhere this migration has run, despite
-- _prisma_migrations recording it as applied.

CREATE TABLE IF NOT EXISTS "data_quality_checks" (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  import_batch_id TEXT REFERENCES "import_batches"(id) ON DELETE CASCADE,
  check_type VARCHAR(100) NOT NULL,
  check_name VARCHAR(255) NOT NULL,
  passed BOOLEAN NOT NULL,
  failures_count INT NOT NULL DEFAULT 0,
  failure_samples JSONB,
  quality_score DECIMAL(5,2) CHECK (quality_score >= 0 AND quality_score <= 100),
  metadata JSONB,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  import_batch_id TEXT NOT NULL UNIQUE REFERENCES "import_batches"(id) ON DELETE CASCADE,
  overall_score DECIMAL(5,2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  checks_passed INT NOT NULL,
  checks_total INT NOT NULL,
  can_commit BOOLEAN NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_batch_quality_org_created
  ON "import_batch_quality_scores"(organization_id, created_at DESC);
