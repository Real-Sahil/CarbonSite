-- Add MFA fields to user table
DO $$
BEGIN
  ALTER TABLE "users" ADD COLUMN "two_factor_secret" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "users" ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
ALTER TABLE "users" ADD COLUMN "two_factor_backed_up_codes" TEXT; -- JSON array of backup codes

-- Create index for finding users with MFA enabled
CREATE INDEX IF NOT EXISTS "users_two_factor_enabled_idx" ON "users"("two_factor_enabled");
