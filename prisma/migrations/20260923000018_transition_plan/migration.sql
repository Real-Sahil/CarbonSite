-- Climate transition plan (ESRS E1-1, UK TPT), one per organisation.
-- CreateTable
CREATE TABLE "transition_plans" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "ambition" TEXT,
    "net_zero_year" INTEGER,
    "strategy" TEXT,
    "engagement" TEXT,
    "governance" TEXT,
    "locked_in_emissions" TEXT,
    "capex_planned" DECIMAL(18,2),
    "opex_planned" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "taxonomy_aligned_capex_pct" DECIMAL(5,2),
    "approval_body" TEXT,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "updated_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transition_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transition_plans_organization_id_key" ON "transition_plans"("organization_id");

-- AddForeignKey
ALTER TABLE "transition_plans" ADD CONSTRAINT "transition_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Deny-all, like every tenant table: only the app (postgres, bypasses RLS) may touch it.
ALTER TABLE "transition_plans" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transition_plans_deny_all" ON "transition_plans" FOR ALL USING (false) WITH CHECK (false);
