ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "image" TEXT;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "ip_address" TEXT;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "user_agent" TEXT;

UPDATE "users"
SET "email_verified" = true
WHERE "email_verified_at" IS NOT NULL;
