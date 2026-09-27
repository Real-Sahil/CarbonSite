-- Hazard reports and site inspections from the field app. Additive only.
ALTER TYPE "field_document_type" ADD VALUE IF NOT EXISTS 'hazard_report';
ALTER TYPE "field_document_type" ADD VALUE IF NOT EXISTS 'site_inspection';
