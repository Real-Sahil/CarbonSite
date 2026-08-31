-- 1. Allow calculations with no matching emission factor: previously the
--    worker wrote a literal "no-factor" FK value, which violated the foreign
--    key and failed the ENTIRE calculation run whenever a single record had
--    no factor match. Null means "no factor found" (totalCo2e 0 + warning).
ALTER TABLE "emission_calculations" ALTER COLUMN "emission_factor_id" DROP NOT NULL;

-- 2. Store a human-readable failure reason on calculation runs so failed
--    runs are debuggable from the UI instead of showing a bare "failed".
DO $$
BEGIN
  ALTER TABLE "calculation_runs" ADD COLUMN IF NOT EXISTS "error_message" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
