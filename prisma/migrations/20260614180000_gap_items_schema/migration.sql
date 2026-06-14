-- Gap items: resubmit flow, target unit, calculation selection reason

-- FieldSubmission: add resubmitted_from_id (self-relation for resubmit flow)
ALTER TABLE "field_submissions"
  ADD COLUMN "resubmitted_from_id" TEXT,
  ADD CONSTRAINT "field_submissions_resubmitted_from_id_fkey"
    FOREIGN KEY ("resubmitted_from_id") REFERENCES "field_submissions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "field_submissions_resubmitted_from_id_idx"
  ON "field_submissions"("resubmitted_from_id");

-- EmissionCalculation: add selection_reason and factor_value
ALTER TABLE "emission_calculations"
  ADD COLUMN "selection_reason" TEXT,
  ADD COLUMN "factor_value" DECIMAL(18,8);

-- ReductionTarget: add unit
ALTER TABLE "reduction_targets"
  ADD COLUMN "unit" TEXT;
