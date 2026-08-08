-- Migration: Add CBAM, GHG Protocol, and CDP report types
-- Adds xmlStorageKey/xmlChecksum to Report for CBAM XML output
-- Also adds intensity metric fields to Organisation

-- Enum values can only be added in Postgres, never removed.
-- Safe to re-run — errors on duplicate are suppressed via IF NOT EXISTS equivalent.
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'ghg_protocol';
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'cdp';
ALTER TYPE "report_type" ADD VALUE IF NOT EXISTS 'cbam';

-- XML artefact storage for CBAM reports
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "xml_storage_key" TEXT;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "xml_checksum" TEXT;
