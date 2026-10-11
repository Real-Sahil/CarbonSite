-- Parse attempts per import batch. An inline parse that times out or fails is
-- retried by the import-batches sweep up to MAX_IMPORT_ATTEMPTS (lib/imports/retry.ts).
-- Additive with a default, so the previous release, which never reads it, keeps working.

-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN     "processing_attempts" INTEGER NOT NULL DEFAULT 0;

