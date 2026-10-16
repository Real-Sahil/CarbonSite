-- Import batches remember the reference data their staged rows were validated against,
-- so a resumed parse restarts when that data changed. Additive only: a new nullable column that
-- no deployed code reads before this release.

-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN     "reference_fingerprint" TEXT;
