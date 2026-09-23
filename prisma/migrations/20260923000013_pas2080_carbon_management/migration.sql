-- PAS 2080:2023 carbon management: a plan per project and a log of carbon
-- reduction opportunities against the reduction hierarchy. New tables only.

-- CreateEnum
CREATE TYPE "value_chain_role" AS ENUM ('asset_owner', 'designer', 'constructor', 'product_supplier');

-- CreateEnum
CREATE TYPE "carbon_hierarchy_level" AS ENUM ('build_nothing', 'build_less', 'build_clever', 'build_efficiently');

-- CreateEnum
CREATE TYPE "carbon_opportunity_status" AS ENUM ('identified', 'under_review', 'adopted', 'implemented', 'rejected');

-- CreateTable
CREATE TABLE "carbon_management_plans" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "value_chain_role" "value_chain_role" NOT NULL,
    "carbon_lead_name" TEXT,
    "baseline_tco2e" DECIMAL(18,4),
    "baseline_basis" TEXT,
    "target_tco2e" DECIMAL(18,4),
    "modules_in_scope" TEXT[],
    "notes" TEXT,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carbon_management_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carbon_reduction_opportunities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "hierarchy_level" "carbon_hierarchy_level" NOT NULL,
    "work_stage" TEXT,
    "lifecycle_modules" TEXT[],
    "estimated_saving_tco2e" DECIMAL(18,4),
    "status" "carbon_opportunity_status" NOT NULL DEFAULT 'identified',
    "decision_rationale" TEXT,
    "owner_name" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carbon_reduction_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carbon_management_plans_project_id_key" ON "carbon_management_plans"("project_id");

-- CreateIndex
CREATE INDEX "carbon_management_plans_organization_id_idx" ON "carbon_management_plans"("organization_id");

-- CreateIndex
CREATE INDEX "carbon_reduction_opportunities_organization_id_project_id_s_idx" ON "carbon_reduction_opportunities"("organization_id", "project_id", "status");

-- AddForeignKey
ALTER TABLE "carbon_management_plans" ADD CONSTRAINT "carbon_management_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carbon_management_plans" ADD CONSTRAINT "carbon_management_plans_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carbon_reduction_opportunities" ADD CONSTRAINT "carbon_reduction_opportunities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carbon_reduction_opportunities" ADD CONSTRAINT "carbon_reduction_opportunities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carbon_reduction_opportunities" ADD CONSTRAINT "carbon_reduction_opportunities_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "carbon_management_plans" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carbon_management_plans_deny_all" ON "carbon_management_plans" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "carbon_reduction_opportunities" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carbon_reduction_opportunities_deny_all" ON "carbon_reduction_opportunities" FOR ALL USING (false) WITH CHECK (false);
