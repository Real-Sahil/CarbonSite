-- CreateEnum
CREATE TYPE virus_scan_status AS ENUM ('pending', 'clean', 'infected', 'skipped');

-- AlterTable
ALTER TABLE "evidence_files" ADD COLUMN "virus_scan_status" virus_scan_status NOT NULL DEFAULT 'pending',
ADD COLUMN "scan_timestamp" TIMESTAMP(3),
ADD COLUMN "scan_provider" TEXT;
