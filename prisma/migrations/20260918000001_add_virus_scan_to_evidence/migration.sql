-- CreateEnum
CREATE TYPE "VirusScanStatus" AS ENUM ('pending', 'clean', 'infected', 'skipped');

-- AlterTable
ALTER TABLE "evidence_files" ADD COLUMN "virus_scan_status" "VirusScanStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN "scan_timestamp" TIMESTAMP(3),
ADD COLUMN "scan_provider" TEXT;
