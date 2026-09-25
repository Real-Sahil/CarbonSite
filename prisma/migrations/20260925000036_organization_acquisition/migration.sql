-- Where each trial came from (?ref / utm_* carried to the sign-up form, else
-- the referrer host). Additive: older code never reads these columns.
-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "acquisition_campaign" TEXT,
ADD COLUMN     "acquisition_medium" TEXT,
ADD COLUMN     "acquisition_source" TEXT;

CREATE INDEX "organizations_acquisition_source_idx" ON "organizations"("acquisition_source");
