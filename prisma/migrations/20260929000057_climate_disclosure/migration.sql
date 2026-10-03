-- Climate-related financial disclosure (TCFD structure): one statement per organisation plus its risk register, and the tcfd_statement report type. Additive.
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

-- CreateTable
CREATE TABLE "climate_risks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "horizon" TEXT NOT NULL,
    "inherent_likelihood" INTEGER NOT NULL,
    "inherent_impact" INTEGER NOT NULL,
    "residual_likelihood" INTEGER,
    "residual_impact" INTEGER,
    "mitigation" TEXT,
    "financial_effect" TEXT,
    "owner_role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "updated_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "climate_risks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "climate_disclosures_organization_id_key" ON "climate_disclosures"("organization_id");

-- CreateIndex
CREATE INDEX "climate_risks_organization_id_horizon_idx" ON "climate_risks"("organization_id", "horizon");

-- AddForeignKey
ALTER TABLE "climate_disclosures" ADD CONSTRAINT "climate_disclosures_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "climate_risks" ADD CONSTRAINT "climate_risks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Deny-all, like every tenant table: only the app (postgres, bypasses RLS) may touch them.
ALTER TABLE "climate_disclosures" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "climate_disclosures_deny_all" ON "climate_disclosures" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "climate_risks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "climate_risks_deny_all" ON "climate_risks" FOR ALL USING (false) WITH CHECK (false);
