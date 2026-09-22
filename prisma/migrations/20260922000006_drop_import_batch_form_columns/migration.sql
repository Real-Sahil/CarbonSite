-- Import batches are a data pipeline, not a structured document, so the
-- document columns added in 20260922000004 and 20260922000005 are unused.
ALTER TABLE "import_batches" DROP COLUMN IF EXISTS "title";
ALTER TABLE "import_batches" DROP COLUMN IF EXISTS "version";
ALTER TABLE "import_batches" DROP COLUMN IF EXISTS "sections_json";
ALTER TABLE "import_batches" DROP COLUMN IF EXISTS "locked_at";
ALTER TABLE "import_batches" DROP COLUMN IF EXISTS "revision_of";
ALTER TABLE "import_batches" DROP COLUMN IF EXISTS "signed_off_by_user_id";
ALTER TABLE "import_batches" DROP COLUMN IF EXISTS "signed_off_at";
