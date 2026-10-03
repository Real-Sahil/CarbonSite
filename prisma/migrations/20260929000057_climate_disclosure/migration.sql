-- Climate-related financial disclosure (TCFD structure): one statement per organisation, and the tcfd_statement report type. The scenarios and risks it reports are the existing TCFD tables. Additive.
-- AlterEnum
ALTER TYPE "report_type" ADD VALUE 'tcfd_statement';

-- CreateTable
CREATE TABLE "climate_disclosures" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sections" JSONB NOT NULL DEFAULT '{}',
    "approval_body" TEXT,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "updated_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "climate_disclosures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "climate_disclosures_organization_id_key" ON "climate_disclosures"("organization_id");

-- AddForeignKey
ALTER TABLE "climate_disclosures" ADD CONSTRAINT "climate_disclosures_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Deny-all, like every tenant table: only the app (postgres, bypasses RLS) may touch it.
ALTER TABLE "climate_disclosures" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "climate_disclosures_deny_all" ON "climate_disclosures" FOR ALL USING (false) WITH CHECK (false);
