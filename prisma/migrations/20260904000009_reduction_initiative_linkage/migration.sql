-- Link reduction initiatives to what they actually reduce: a facility, an
-- emission category, and (optionally) the reduction target they count
-- toward. Without this, an initiative's MACC-ranked abatement had no way
-- to be attributed to a specific completeness-matrix gap or target
-- trajectory — it just floated in a list.

ALTER TABLE "reduction_initiatives" ADD COLUMN IF NOT EXISTS "facility_id" TEXT;
ALTER TABLE "reduction_initiatives" ADD COLUMN IF NOT EXISTS "emission_category_id" TEXT;
ALTER TABLE "reduction_initiatives" ADD COLUMN IF NOT EXISTS "reduction_target_id" TEXT;

CREATE INDEX IF NOT EXISTS "reduction_initiatives_organization_id_facility_id_idx"
  ON "reduction_initiatives"("organization_id", "facility_id");

CREATE INDEX IF NOT EXISTS "reduction_initiatives_organization_id_emission_category_id_idx"
  ON "reduction_initiatives"("organization_id", "emission_category_id");

CREATE INDEX IF NOT EXISTS "reduction_initiatives_organization_id_reduction_target_id_idx"
  ON "reduction_initiatives"("organization_id", "reduction_target_id");

DO $$ BEGIN
  ALTER TABLE "reduction_initiatives" ADD CONSTRAINT "reduction_initiatives_facility_id_fkey"
    FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "reduction_initiatives" ADD CONSTRAINT "reduction_initiatives_emission_category_id_fkey"
    FOREIGN KEY ("emission_category_id") REFERENCES "emission_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "reduction_initiatives" ADD CONSTRAINT "reduction_initiatives_reduction_target_id_fkey"
    FOREIGN KEY ("reduction_target_id") REFERENCES "reduction_targets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
