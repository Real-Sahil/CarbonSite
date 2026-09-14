-- Add isPilot flag to Organization for unlimited access pilot users
ALTER TABLE "organizations" ADD COLUMN "is_pilot" BOOLEAN NOT NULL DEFAULT false;

-- Create index for filtering pilot orgs
CREATE INDEX "idx_organizations_is_pilot" ON "organizations"("is_pilot");
