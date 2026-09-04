-- Scientific rigour in the calculation engine: ISO 14040/44 pedigree matrix
-- scores and their geometric standard deviation, biogenic CO2 reported as a
-- separate memo item per the GHG Protocol, and Monte Carlo uncertainty
-- propagation results at the calculation-run level.

-- ─── Biogenic CO2 on the emission factor ──────────────────────────────────────

ALTER TABLE "emission_factors" ADD COLUMN IF NOT EXISTS "biogenic_co2" DECIMAL(18,8);

-- ─── Pedigree matrix and temporal representativeness on each calculation ─────

ALTER TABLE "emission_calculations" ADD COLUMN IF NOT EXISTS "pedigree_scores" JSONB;
ALTER TABLE "emission_calculations" ADD COLUMN IF NOT EXISTS "geometric_std_dev" DECIMAL(10,6);
ALTER TABLE "emission_calculations" ADD COLUMN IF NOT EXISTS "temporal_representativeness_years" DECIMAL(6,2);

-- ─── Monte Carlo uncertainty propagation results (one row per run) ────────────

CREATE TABLE IF NOT EXISTS "calculation_uncertainty_results" (
  "id"                    TEXT NOT NULL,
  "organization_id"       TEXT NOT NULL,
  "calculation_run_id"    TEXT NOT NULL,
  "total_co2e"            DECIMAL(18,8) NOT NULL,
  "monte_carlo_mean"      DECIMAL(18,8) NOT NULL,
  "monte_carlo_median"    DECIMAL(18,8) NOT NULL,
  "monte_carlo_p2_5"      DECIMAL(18,8) NOT NULL,
  "monte_carlo_p97_5"     DECIMAL(18,8) NOT NULL,
  "naive_interval_lower"  DECIMAL(18,8) NOT NULL,
  "naive_interval_upper"  DECIMAL(18,8) NOT NULL,
  "iterations"            INTEGER NOT NULL,
  "seed"                  INTEGER NOT NULL,
  "record_count"          INTEGER NOT NULL,
  "scope_breakdown"       JSONB NOT NULL,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "calculation_uncertainty_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "calculation_uncertainty_results_calculation_run_id_key"
  ON "calculation_uncertainty_results"("calculation_run_id");

CREATE INDEX IF NOT EXISTS "calculation_uncertainty_results_organization_id_idx"
  ON "calculation_uncertainty_results"("organization_id");

DO $$ BEGIN
  ALTER TABLE "calculation_uncertainty_results" ADD CONSTRAINT "calculation_uncertainty_results_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "calculation_uncertainty_results" ADD CONSTRAINT "calculation_uncertainty_results_calculation_run_id_fkey"
    FOREIGN KEY ("calculation_run_id") REFERENCES "calculation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
