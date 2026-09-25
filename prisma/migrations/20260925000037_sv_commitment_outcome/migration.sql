-- Links a social value commitment (for example a PPN 026 contract KPI) to the
-- framework criterion it answers. Additive; older code never reads it.
-- AlterTable
ALTER TABLE "sv_commitments" ADD COLUMN     "outcome_id" TEXT;

-- CreateIndex
CREATE INDEX "sv_commitments_outcome_id_idx" ON "sv_commitments"("outcome_id");

-- AddForeignKey
ALTER TABLE "sv_commitments" ADD CONSTRAINT "sv_commitments_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "sv_outcomes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

