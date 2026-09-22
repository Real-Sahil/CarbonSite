-- Add structured document workspace columns to 6 models

-- HsIncidentReport
ALTER TABLE "hs_incident_reports" ADD COLUMN "sections_json" JSONB;
ALTER TABLE "hs_incident_reports" ADD COLUMN "locked_at" TIMESTAMPTZ;
ALTER TABLE "hs_incident_reports" ADD COLUMN "revision_of" TEXT;

-- EnvironmentalIncident
ALTER TABLE "environmental_incidents" ADD COLUMN "sections_json" JSONB;
ALTER TABLE "environmental_incidents" ADD COLUMN "locked_at" TIMESTAMPTZ;
ALTER TABLE "environmental_incidents" ADD COLUMN "revision_of" TEXT;

-- EnvironmentalPermit
ALTER TABLE "environmental_permits" ADD COLUMN "sections_json" JSONB;
ALTER TABLE "environmental_permits" ADD COLUMN "locked_at" TIMESTAMPTZ;
ALTER TABLE "environmental_permits" ADD COLUMN "revision_of" TEXT;

-- AssuranceEngagement
ALTER TABLE "assurance_engagements" ADD COLUMN "sections_json" JSONB;
ALTER TABLE "assurance_engagements" ADD COLUMN "locked_at" TIMESTAMPTZ;
ALTER TABLE "assurance_engagements" ADD COLUMN "revision_of" TEXT;

-- BiodiversityAssessment
ALTER TABLE "biodiversity_assessments" ADD COLUMN "sections_json" JSONB;
ALTER TABLE "biodiversity_assessments" ADD COLUMN "locked_at" TIMESTAMPTZ;
ALTER TABLE "biodiversity_assessments" ADD COLUMN "revision_of" TEXT;

-- ImportBatch
ALTER TABLE "import_batches" ADD COLUMN "sections_json" JSONB;
ALTER TABLE "import_batches" ADD COLUMN "locked_at" TIMESTAMPTZ;
ALTER TABLE "import_batches" ADD COLUMN "revision_of" TEXT;
