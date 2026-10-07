-- AlterTable
ALTER TABLE "submission_links" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'bills';

-- CreateTable
CREATE TABLE "waste_documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reference" TEXT,
    "issuer" TEXT,
    "valid_until" DATE,
    "evidence_file_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'accepted',
    "submission_link_id" TEXT,
    "uploader_name" TEXT,
    "uploader_company" TEXT,
    "note" TEXT,
    "created_by_user_id" TEXT,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "waste_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "waste_documents_organization_id_status_created_at_idx" ON "waste_documents"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "waste_documents_organization_id_kind_valid_until_idx" ON "waste_documents"("organization_id", "kind", "valid_until");

-- AddForeignKey
ALTER TABLE "waste_documents" ADD CONSTRAINT "waste_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "waste_documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waste_documents_deny_all" ON "waste_documents" FOR ALL USING (false) WITH CHECK (false);
