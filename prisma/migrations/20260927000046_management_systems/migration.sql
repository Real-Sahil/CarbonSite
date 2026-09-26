-- Management systems: organisations adopt catalogue frameworks (ISO 14001,
-- ISO 45001, ISO 9001, ...), record their position on each requirement and
-- link evidence. The catalogue itself is in the repo, not the database.

-- CreateEnum
CREATE TYPE "MsAdoptionStatus" AS ENUM ('implementing', 'certified', 'lapsed', 'withdrawn');

-- CreateEnum
CREATE TYPE "MsRequirementState" AS ENUM ('not_started', 'in_progress', 'implemented', 'not_applicable');

-- CreateEnum
CREATE TYPE "MsEvidenceKind" AS ENUM ('evidence_file', 'legal_register_entry', 'environmental_aspect', 'environmental_permit', 'environmental_incident', 'hs_incident_report', 'method_statement', 'reduction_target', 'url', 'note');

-- CreateTable
CREATE TABLE "ms_framework_adoptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "framework_slug" TEXT NOT NULL,
    "status" "MsAdoptionStatus" NOT NULL DEFAULT 'implementing',
    "scope" TEXT,
    "target_date" DATE,
    "certification_body" TEXT,
    "certificate_number" TEXT,
    "certified_until" DATE,
    "adopted_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_framework_adoptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_requirement_statuses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "framework_slug" TEXT NOT NULL,
    "requirement_code" TEXT NOT NULL,
    "status" "MsRequirementState" NOT NULL DEFAULT 'not_started',
    "owner_user_id" TEXT,
    "due_on" DATE,
    "notes" TEXT,
    "updated_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_requirement_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_evidence_links" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "framework_slug" TEXT NOT NULL,
    "requirement_code" TEXT NOT NULL,
    "kind" "MsEvidenceKind" NOT NULL,
    "target_id" TEXT,
    "url" TEXT,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ms_evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ms_framework_adoptions_organization_id_framework_slug_key" ON "ms_framework_adoptions"("organization_id", "framework_slug");

-- CreateIndex
CREATE UNIQUE INDEX "ms_requirement_statuses_organization_id_framework_slug_requ_key" ON "ms_requirement_statuses"("organization_id", "framework_slug", "requirement_code");

-- CreateIndex
CREATE INDEX "ms_evidence_links_organization_id_framework_slug_requiremen_idx" ON "ms_evidence_links"("organization_id", "framework_slug", "requirement_code");

-- AddForeignKey
ALTER TABLE "ms_framework_adoptions" ADD CONSTRAINT "ms_framework_adoptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_requirement_statuses" ADD CONSTRAINT "ms_requirement_statuses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_evidence_links" ADD CONSTRAINT "ms_evidence_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The app connects as postgres and bypasses RLS; the Data API roles get nothing.
ALTER TABLE "ms_framework_adoptions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_framework_adoptions_deny_all" ON "ms_framework_adoptions" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_requirement_statuses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_requirement_statuses_deny_all" ON "ms_requirement_statuses" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_evidence_links" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_evidence_links_deny_all" ON "ms_evidence_links" FOR ALL USING (false) WITH CHECK (false);
