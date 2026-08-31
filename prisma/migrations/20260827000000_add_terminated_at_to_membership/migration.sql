-- Add soft-delete support for supplier accounts
DO $$
BEGIN
  ALTER TABLE "organization_memberships" ADD COLUMN "terminated_at" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Create index for filtering active memberships
CREATE INDEX IF NOT EXISTS "organization_memberships_terminated_at_idx" ON "organization_memberships"("terminated_at");
