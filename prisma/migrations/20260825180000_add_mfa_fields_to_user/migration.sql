-- Add MFA fields to user table
ALTER TABLE "users" ADD COLUMN "two_factor_secret" TEXT;
ALTER TABLE "users" ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "two_factor_backed_up_codes" TEXT; -- JSON array of backup codes

-- Create index for finding users with MFA enabled
CREATE INDEX "users_two_factor_enabled_idx" ON "users"("two_factor_enabled");
