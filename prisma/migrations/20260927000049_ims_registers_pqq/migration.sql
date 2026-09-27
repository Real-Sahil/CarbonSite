-- Management systems: document control, competence and training, objectives,
-- complaints, nonconforming outputs, supplier evaluations, equipment,
-- inspections, planned changes, acknowledgements, reminder log, auditor
-- access, and pre-qualification answers. Additive only.


-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_document';
ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_competence';
ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_training_record';
ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_objective';
ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_complaint';
ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_nonconformity';
ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_supplier_evaluation';
ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_equipment';
ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_inspection_template';
ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_inspection';
ALTER TYPE "MsEvidenceKind" ADD VALUE 'ms_change';

-- CreateTable
CREATE TABLE "ms_documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reference" TEXT,
    "title" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL DEFAULT 'procedure',
    "frameworks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "body" TEXT,
    "file_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "change_note" TEXT,
    "owner_user_id" TEXT,
    "approved_by_user_id" TEXT,
    "approved_on" DATE,
    "review_on" DATE,
    "requires_acknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_competences" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'course',
    "applies_to" TEXT,
    "validity_months" INTEGER,
    "frameworks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_competences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_training_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "competence_id" TEXT NOT NULL,
    "person_user_id" TEXT,
    "person_name" TEXT NOT NULL,
    "employer" TEXT,
    "completed_on" DATE,
    "expires_on" DATE,
    "provider" TEXT,
    "reference" TEXT,
    "file_id" TEXT,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_training_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_objectives" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "frameworks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "measure" TEXT,
    "unit" TEXT,
    "baseline" DOUBLE PRECISION,
    "target" DOUBLE PRECISION,
    "current" DOUBLE PRECISION,
    "target_date" DATE,
    "owner_user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'on_track',
    "plan" TEXT,
    "review_on" DATE,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_complaints" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "received_on" DATE,
    "complainant" TEXT,
    "channel" TEXT,
    "category" TEXT NOT NULL DEFAULT 'quality',
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "description" TEXT,
    "response" TEXT,
    "owner_user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closed_on" DATE,
    "corrective_action_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_nonconformities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detected_on" DATE,
    "location" TEXT,
    "description" TEXT,
    "disposition" TEXT,
    "cost" DOUBLE PRECISION,
    "owner_user_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "corrective_action_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_nonconformities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_supplier_evaluations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "scope" TEXT,
    "criteria" TEXT,
    "quality_score" INTEGER,
    "safety_score" INTEGER,
    "environment_score" INTEGER,
    "approval_status" TEXT NOT NULL DEFAULT 'approved',
    "evaluated_on" DATE,
    "next_review_on" DATE,
    "owner_user_id" TEXT,
    "frameworks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_supplier_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_equipment" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT,
    "equipment_type" TEXT NOT NULL DEFAULT 'measuring',
    "location" TEXT,
    "check_type" TEXT NOT NULL DEFAULT 'calibration',
    "interval_months" INTEGER,
    "last_checked_on" DATE,
    "next_due_on" DATE,
    "status" TEXT NOT NULL DEFAULT 'in_service',
    "file_id" TEXT,
    "owner_user_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_inspection_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "frequency" TEXT,
    "frameworks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_inspection_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_inspections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "inspected_on" DATE,
    "inspector_user_id" TEXT,
    "results" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "notes" TEXT,
    "corrective_action_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_changes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "frameworks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reason" TEXT,
    "consequences" TEXT,
    "resources" TEXT,
    "owner_user_id" TEXT,
    "planned_on" DATE,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "approved_by_user_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ms_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_acknowledgements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "register_key" TEXT NOT NULL,
    "row_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "acknowledged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ms_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_reminder_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "row_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "due_on" DATE NOT NULL,
    "stage" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ms_reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ms_auditor_accesses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "company" TEXT,
    "frameworks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ms_auditor_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pqq_answers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "topic_key" TEXT NOT NULL,
    "response" TEXT,
    "answer" TEXT,
    "evidence_file_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updated_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pqq_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pqq_question_sets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "due_on" DATE,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pqq_question_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ms_documents_organization_id_status_idx" ON "ms_documents"("organization_id", "status");

-- CreateIndex
CREATE INDEX "ms_competences_organization_id_idx" ON "ms_competences"("organization_id");

-- CreateIndex
CREATE INDEX "ms_training_records_organization_id_competence_id_idx" ON "ms_training_records"("organization_id", "competence_id");

-- CreateIndex
CREATE INDEX "ms_training_records_organization_id_expires_on_idx" ON "ms_training_records"("organization_id", "expires_on");

-- CreateIndex
CREATE INDEX "ms_objectives_organization_id_status_idx" ON "ms_objectives"("organization_id", "status");

-- CreateIndex
CREATE INDEX "ms_complaints_organization_id_status_idx" ON "ms_complaints"("organization_id", "status");

-- CreateIndex
CREATE INDEX "ms_nonconformities_organization_id_status_idx" ON "ms_nonconformities"("organization_id", "status");

-- CreateIndex
CREATE INDEX "ms_supplier_evaluations_organization_id_approval_status_idx" ON "ms_supplier_evaluations"("organization_id", "approval_status");

-- CreateIndex
CREATE INDEX "ms_equipment_organization_id_next_due_on_idx" ON "ms_equipment"("organization_id", "next_due_on");

-- CreateIndex
CREATE INDEX "ms_inspection_templates_organization_id_idx" ON "ms_inspection_templates"("organization_id");

-- CreateIndex
CREATE INDEX "ms_inspections_organization_id_template_id_idx" ON "ms_inspections"("organization_id", "template_id");

-- CreateIndex
CREATE INDEX "ms_changes_organization_id_status_idx" ON "ms_changes"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ms_acknowledgements_organization_id_register_key_row_id_ver_key" ON "ms_acknowledgements"("organization_id", "register_key", "row_id", "version", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ms_reminder_logs_organization_id_source_row_id_field_due_on_key" ON "ms_reminder_logs"("organization_id", "source", "row_id", "field", "due_on", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "ms_auditor_accesses_token_hash_key" ON "ms_auditor_accesses"("token_hash");

-- CreateIndex
CREATE INDEX "ms_auditor_accesses_organization_id_idx" ON "ms_auditor_accesses"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "pqq_answers_organization_id_topic_key_key" ON "pqq_answers"("organization_id", "topic_key");

-- CreateIndex
CREATE INDEX "pqq_question_sets_organization_id_idx" ON "pqq_question_sets"("organization_id");

-- AddForeignKey
ALTER TABLE "ms_documents" ADD CONSTRAINT "ms_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_competences" ADD CONSTRAINT "ms_competences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_training_records" ADD CONSTRAINT "ms_training_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_objectives" ADD CONSTRAINT "ms_objectives_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_complaints" ADD CONSTRAINT "ms_complaints_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_nonconformities" ADD CONSTRAINT "ms_nonconformities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_supplier_evaluations" ADD CONSTRAINT "ms_supplier_evaluations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_equipment" ADD CONSTRAINT "ms_equipment_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_inspection_templates" ADD CONSTRAINT "ms_inspection_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_inspections" ADD CONSTRAINT "ms_inspections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_changes" ADD CONSTRAINT "ms_changes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_acknowledgements" ADD CONSTRAINT "ms_acknowledgements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_reminder_logs" ADD CONSTRAINT "ms_reminder_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ms_auditor_accesses" ADD CONSTRAINT "ms_auditor_accesses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pqq_answers" ADD CONSTRAINT "pqq_answers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pqq_question_sets" ADD CONSTRAINT "pqq_question_sets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security: deny-all (the app connects as postgres; see migration 20260922000012).
ALTER TABLE "ms_documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_documents_deny_all" ON "ms_documents" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_competences" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_competences_deny_all" ON "ms_competences" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_training_records" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_training_records_deny_all" ON "ms_training_records" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_objectives" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_objectives_deny_all" ON "ms_objectives" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_complaints" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_complaints_deny_all" ON "ms_complaints" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_nonconformities" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_nonconformities_deny_all" ON "ms_nonconformities" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_supplier_evaluations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_supplier_evaluations_deny_all" ON "ms_supplier_evaluations" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_equipment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_equipment_deny_all" ON "ms_equipment" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_inspection_templates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_inspection_templates_deny_all" ON "ms_inspection_templates" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_inspections" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_inspections_deny_all" ON "ms_inspections" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_changes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_changes_deny_all" ON "ms_changes" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_acknowledgements" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_acknowledgements_deny_all" ON "ms_acknowledgements" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_reminder_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_reminder_logs_deny_all" ON "ms_reminder_logs" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "ms_auditor_accesses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_auditor_accesses_deny_all" ON "ms_auditor_accesses" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "pqq_answers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pqq_answers_deny_all" ON "pqq_answers" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "pqq_question_sets" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pqq_question_sets_deny_all" ON "pqq_question_sets" FOR ALL USING (false) WITH CHECK (false);
