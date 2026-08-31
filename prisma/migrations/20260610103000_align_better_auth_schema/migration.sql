DO $$
BEGIN
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "image" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "ip_address" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "user_agent" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

UPDATE "users"
SET "email_verified" = true
WHERE "email_verified_at" IS NOT NULL;
