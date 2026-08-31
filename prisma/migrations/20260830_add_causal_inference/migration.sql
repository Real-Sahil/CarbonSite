-- Add Causal Inference capability for root cause analysis
-- Stores results of causal analysis runs (facility upgrades, supplier switches, process changes)

CREATE TABLE IF NOT EXISTS "causal_inference_runs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "treatment" VARCHAR(100) NOT NULL,
  "outcome" VARCHAR(100) NOT NULL,
  "treatment_effect" DECIMAL(10,4),
  "confidence_interval_lower" DECIMAL(10,4),
  "confidence_interval_upper" DECIMAL(10,4),
  "p_value" DECIMAL(5,4),
  "robustness_to_unmeasured_confounding" DECIMAL(3,2),
  "sample_size" INTEGER,
  "method" VARCHAR(50),
  "causal_graph" JSONB,
  "model_id" VARCHAR(50),
  "confounders" JSONB,
  "result_summary" TEXT,
  "status" VARCHAR(50) NOT NULL DEFAULT 'completed',
  "error_message" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "causal_inference_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE
);

-- Index for querying by organization and creation time
CREATE INDEX IF NOT EXISTS "causal_inference_runs_organization_id_created_at_idx" ON "causal_inference_runs"("organization_id", "created_at" DESC);

-- Index for querying by status
CREATE INDEX IF NOT EXISTS "causal_inference_runs_organization_id_status_idx" ON "causal_inference_runs"("organization_id", "status");

-- Index for model-based queries
CREATE INDEX IF NOT EXISTS "causal_inference_runs_organization_id_model_id_idx" ON "causal_inference_runs"("organization_id", "model_id");
