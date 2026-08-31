-- Gap items: resubmit flow, target unit, calculation selection reason

-- FieldSubmission: add resubmitted_from_id (self-relation for resubmit flow)
DO $$
BEGIN
  ALTER TABLE "field_submissions"
  ADD COLUMN "resubmitted_from_id" TEXT,
  ADD CONSTRAINT "field_submissions_resubmitted_from_id_fkey"
  FOREIGN KEY ("resubmitted_from_id") REFERENCES "field_submissions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "field_submissions_resubmitted_from_id_idx"
  ON "field_submissions"("resubmitted_from_id");

-- EmissionCalculation: add selection_reason and factor_value
DO $$
BEGIN
  ALTER TABLE "emission_calculations"
  ADD COLUMN "selection_reason" TEXT,
  ADD COLUMN "factor_value" DECIMAL(18,8);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ReductionTarget: add unit
DO $$
BEGIN
  ALTER TABLE "reduction_targets"
  ADD COLUMN "unit" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
