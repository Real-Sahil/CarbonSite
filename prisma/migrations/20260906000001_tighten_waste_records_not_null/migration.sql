-- Follow-up to 20260906000000_phase_h_water_waste_esrs: tightens
-- waste_records.facility_id / reporting_period_id to NOT NULL now that the
-- application always assigns both on create (see app/api/orgs/[orgId]/
-- waste-records/route.ts and lib/field-submissions/approve.ts).
--
-- This migration is self-contained and safe to run in any state, so it
-- does not depend on scripts/backfill-waste-records.ts having been run
-- first:
--   1. Auto-resolves facility_id for any remaining legacy row whose
--      organisation has exactly one facility (the same rule the backfill
--      script uses) - unambiguous, no data-quality risk.
--   2. Auto-resolves reporting_period_id by matching recorded_at against
--      each org's reporting period date ranges - also unambiguous.
--   3. Aborts the whole migration (no partial state, transaction rolls
--      back) if any row remains unresolved after that - e.g. an org with
--      zero or multiple facilities and no single obvious owner for a
--      legacy row. Vercel's vercel-build runs `prisma migrate deploy` on
--      every production deploy, so an abort here fails that build loudly
--      rather than silently truncating or guessing which facility owns
--      a row that matters for an ESRS disclosure.
--
-- activity_record_id intentionally stays nullable - it depends on the
-- real calculation engine (factor selection can fail; a row can be
-- mid-calculation), never on data this migration can determine directly.
-- Run scripts/backfill-waste-records.ts after this migration (or before -
-- either order is safe) to complete the ActivityRecord/EmissionCalculation
-- link for any row this migration only resolved facility/period for.

-- 1. Auto-resolve facility_id where the organisation has exactly one facility.
UPDATE "waste_records" wr
SET "facility_id" = single_facility.id
FROM (
  SELECT organization_id, MIN(id) AS id
  FROM "facilities"
  GROUP BY organization_id
  HAVING COUNT(*) = 1
) AS single_facility
WHERE wr."facility_id" IS NULL
  AND wr."organization_id" = single_facility.organization_id;

-- 2. Auto-resolve reporting_period_id by date-range match.
UPDATE "waste_records" wr
SET "reporting_period_id" = rp.id
FROM "reporting_periods" rp
WHERE wr."reporting_period_id" IS NULL
  AND wr."organization_id" = rp."organization_id"
  AND wr."recorded_at" >= rp."start_date"
  AND wr."recorded_at" <= rp."end_date";

-- 3. Abort loudly if anything remains unresolved - see header comment.
DO $$
DECLARE
  unresolved_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unresolved_count
  FROM "waste_records"
  WHERE "facility_id" IS NULL OR "reporting_period_id" IS NULL;

  IF unresolved_count > 0 THEN
    RAISE EXCEPTION
      'Cannot tighten waste_records.facility_id/reporting_period_id to NOT NULL: % row(s) still unresolved (organisation has zero or multiple facilities, or no reporting period covers recorded_at). Resolve these manually via the /waste page (edit each record to assign a facility/period), then re-deploy.',
      unresolved_count;
  END IF;
END $$;

-- 4. Tighten the constraints.
ALTER TABLE "waste_records" ALTER COLUMN "facility_id" SET NOT NULL;
ALTER TABLE "waste_records" ALTER COLUMN "reporting_period_id" SET NOT NULL;

-- 5. Both FKs were created as ON DELETE SET NULL when the columns were
-- still optional; now that they're required, a facility/period can no
-- longer be deleted out from under a waste record - match schema.prisma's
-- default for a required relation (RESTRICT) instead.
ALTER TABLE "waste_records" DROP CONSTRAINT IF EXISTS "waste_records_facility_id_fkey";
DO $$ BEGIN
  ALTER TABLE "waste_records" ADD CONSTRAINT "waste_records_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "waste_records" DROP CONSTRAINT IF EXISTS "waste_records_reporting_period_id_fkey";
DO $$ BEGIN
  ALTER TABLE "waste_records" ADD CONSTRAINT "waste_records_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
