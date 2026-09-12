-- Add ecology_scan to the report_type enum.
-- ecology_survey = Biodiversity Net Gain (BNG) metric assessments (Phase C).
-- ecology_scan   = Live NBN Atlas / MAGIC / FC woodland scan export (Phase H).
DO $$ BEGIN
  ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'ecology_scan';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
