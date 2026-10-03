-- Project case studies and the site_noticeboard report type. Additive.
-- AlterEnum
ALTER TYPE "report_type" ADD VALUE 'site_noticeboard';

-- CreateTable
CREATE TABLE "case_studies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contract_id" TEXT,
    "title" TEXT NOT NULL,
    "problem" TEXT NOT NULL DEFAULT '',
    "solution" TEXT NOT NULL DEFAULT '',
    "baseline" TEXT NOT NULL DEFAULT '',
    "results" TEXT NOT NULL DEFAULT '',
    "kpis" JSONB NOT NULL DEFAULT '[]',
    "assumptions" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_studies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_studies_organization_id_contract_id_idx" ON "case_studies"("organization_id", "contract_id");

-- AddForeignKey
ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Deny-all, like every tenant table: only the app (postgres, bypasses RLS) may touch it.
ALTER TABLE "case_studies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "case_studies_deny_all" ON "case_studies" FOR ALL USING (false) WITH CHECK (false);
