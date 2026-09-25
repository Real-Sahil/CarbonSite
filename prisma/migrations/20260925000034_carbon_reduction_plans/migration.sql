-- CreateTable
CREATE TABLE "carbon_reduction_plans" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sections" JSONB NOT NULL DEFAULT '{}',
    "last_report_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "updated_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carbon_reduction_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carbon_reduction_plans_organization_id_reporting_period_id_key" ON "carbon_reduction_plans"("organization_id", "reporting_period_id");

-- AddForeignKey
ALTER TABLE "carbon_reduction_plans" ADD CONSTRAINT "carbon_reduction_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carbon_reduction_plans" ADD CONSTRAINT "carbon_reduction_plans_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Deny-all, like every tenant table: only the app (postgres, bypasses RLS) may touch it.
ALTER TABLE "carbon_reduction_plans" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carbon_reduction_plans_deny_all" ON "carbon_reduction_plans" FOR ALL USING (false) WITH CHECK (false);
