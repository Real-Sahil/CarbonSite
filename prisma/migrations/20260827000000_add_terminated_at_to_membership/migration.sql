-- Add soft-delete support for supplier accounts
ALTER TABLE "organization_memberships" ADD COLUMN "terminated_at" TIMESTAMP(3);

-- Create index for filtering active memberships
CREATE INDEX "organization_memberships_terminated_at_idx" ON "organization_memberships"("terminated_at");
