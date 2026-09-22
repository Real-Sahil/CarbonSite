-- Add structured forms fields to all 6 models

-- EnvironmentalIncident: add title, version, signedOffByUserId, signedOffAt
ALTER TABLE "environmental_incidents" ADD COLUMN "title" TEXT;
ALTER TABLE "environmental_incidents" ADD COLUMN "version" TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE "environmental_incidents" ADD COLUMN "signed_off_by_user_id" TEXT;
ALTER TABLE "environmental_incidents" ADD COLUMN "signed_off_at" TIMESTAMPTZ;

-- EnvironmentalPermit: add version, signedOffByUserId, signedOffAt
ALTER TABLE "environmental_permits" ADD COLUMN "version" TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE "environmental_permits" ADD COLUMN "signed_off_by_user_id" TEXT;
ALTER TABLE "environmental_permits" ADD COLUMN "signed_off_at" TIMESTAMPTZ;

-- AssuranceEngagement: add title, version, signedOffByUserId, signedOffAt
ALTER TABLE "assurance_engagements" ADD COLUMN "title" TEXT;
ALTER TABLE "assurance_engagements" ADD COLUMN "version" TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE "assurance_engagements" ADD COLUMN "signed_off_by_user_id" TEXT;
ALTER TABLE "assurance_engagements" ADD COLUMN "signed_off_at" TIMESTAMPTZ;

-- BiodiversityAssessment: add title, version, signedOffByUserId, signedOffAt
ALTER TABLE "biodiversity_assessments" ADD COLUMN "title" TEXT;
ALTER TABLE "biodiversity_assessments" ADD COLUMN "version" TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE "biodiversity_assessments" ADD COLUMN "signed_off_by_user_id" TEXT;
ALTER TABLE "biodiversity_assessments" ADD COLUMN "signed_off_at" TIMESTAMPTZ;

-- ImportBatch: add title, version, signedOffByUserId, signedOffAt
ALTER TABLE "import_batches" ADD COLUMN "title" TEXT;
ALTER TABLE "import_batches" ADD COLUMN "version" TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE "import_batches" ADD COLUMN "signed_off_by_user_id" TEXT;
ALTER TABLE "import_batches" ADD COLUMN "signed_off_at" TIMESTAMPTZ;

-- HsIncidentReport: add title, version, createdByUserId, signedOffByUserId, signedOffAt
ALTER TABLE "hs_incident_reports" ADD COLUMN "title" TEXT;
ALTER TABLE "hs_incident_reports" ADD COLUMN "version" TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE "hs_incident_reports" ADD COLUMN "signed_off_by_user_id" TEXT;
ALTER TABLE "hs_incident_reports" ADD COLUMN "signed_off_at" TIMESTAMPTZ;
ALTER TABLE "hs_incident_reports" ADD COLUMN "created_by_user_id" TEXT;
