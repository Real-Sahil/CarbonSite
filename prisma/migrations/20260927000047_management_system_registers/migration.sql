-- Registers shared by every management system framework: risks and
-- opportunities, interested parties, policies, internal audits and findings,
-- corrective actions and management reviews. Additive only.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_risk';
ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_interested_party';
ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_policy';
ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_audit';
ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_audit_finding';
ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_corrective_action';
ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_management_review';

-- CreateTable
CREATE TABLE "ms_risks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'risk',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "frameworks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "likelihood" INTEGER NOT NULL DEFAULT 3,
    "impact" INTEGER NOT NULL DEFAULT 3,
    "treatment" TEXT NOT NULL DEFAULT 'mitigate',
    "controls" TEXT,
    "residual_likelihood" INTEGER,
    "residual_impact" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'open',
    "owner_user_id" TEXT,
    "review_on" DATE,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_interested_parties" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "needs" TEXT,
    "becomes_obligation" BOOLEAN NOT NULL DEFAULT false,
    "how_monitored" TEXT,
    "frameworks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_interested_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_policies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "frameworks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "body" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "owner_user_id" TEXT,
    "approved_by_user_id" TEXT,
    "approved_on" DATE,
    "review_on" DATE,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_audits" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "frameworks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scope" TEXT,
    "planned_on" DATE,
    "completed_on" DATE,
    "lead_auditor_user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "summary" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_audit_findings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "audit_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'observation',
    "reference" TEXT,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_audit_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_corrective_actions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'other',
    "source_reference" TEXT,
    "description" TEXT,
    "root_cause" TEXT,
    "action" TEXT,
    "owner_user_id" TEXT,
    "due_on" DATE,
    "status" TEXT NOT NULL DEFAULT 'open',
    "verified_by_user_id" TEXT,
    "verified_on" DATE,
    "effectiveness" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_corrective_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_management_reviews" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "held_on" DATE,
    "frameworks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attendees" TEXT,
    "inputs" TEXT,
    "decisions" TEXT,
    "actions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_management_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ms_risks_organization_id_status_idx" ON "ms_risks"("organization_id", "status");

-- CreateIndex
CREATE INDEX "ms_interested_parties_organization_id_idx" ON "ms_interested_parties"("organization_id");

-- CreateIndex
CREATE INDEX "ms_policies_organization_id_status_idx" ON "ms_policies"("organization_id", "status");

-- CreateIndex
CREATE INDEX "ms_audits_organization_id_status_idx" ON "ms_audits"("organization_id", "status");

-- CreateIndex
CREATE INDEX "ms_audit_findings_organization_id_audit_id_idx" ON "ms_audit_findings"("organization_id", "audit_id");

-- CreateIndex
CREATE INDEX "ms_corrective_actions_organization_id_status_idx" ON "ms_corrective_actions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "ms_management_reviews_organization_id_held_on_idx" ON "ms_management_reviews"("organization_id", "held_on");

-- AddForeignKey
ALTER TABLE "ms_risks" ADD CONSTRAINT "ms_risks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_interested_parties" ADD CONSTRAINT "ms_interested_parties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_policies" ADD CONSTRAINT "ms_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_audits" ADD CONSTRAINT "ms_audits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_audit_findings" ADD CONSTRAINT "ms_audit_findings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_audit_findings" ADD CONSTRAINT "ms_audit_findings_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "ms_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_corrective_actions" ADD CONSTRAINT "ms_corrective_actions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_management_reviews" ADD CONSTRAINT "ms_management_reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The app connects as postgres and bypasses RLS; the Data API roles get nothing.
ALTER TABLE "ms_risks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_risks_deny_all" ON "ms_risks" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_interested_parties" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_interested_parties_deny_all" ON "ms_interested_parties" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_policies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_policies_deny_all" ON "ms_policies" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_audits" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_audits_deny_all" ON "ms_audits" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_audit_findings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_audit_findings_deny_all" ON "ms_audit_findings" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_corrective_actions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_corrective_actions_deny_all" ON "ms_corrective_actions" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_management_reviews" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_management_reviews_deny_all" ON "ms_management_reviews" FOR ALL USING (false) WITH CHECK (false);
