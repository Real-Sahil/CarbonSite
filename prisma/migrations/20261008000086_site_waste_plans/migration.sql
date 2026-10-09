-- CreateTable
CREATE TABLE "site_waste_plans" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "responsible_person" TEXT,
    "principal_contractor" TEXT,
    "client_name" TEXT,
    "target_diversion_pct" DECIMAL(5,2),
    "actions" TEXT,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "next_review_on" DATE,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMPTZ(6),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "site_waste_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_waste_plans_organization_id_project_id_key" ON "site_waste_plans"("organization_id", "project_id");

-- AddForeignKey
ALTER TABLE "site_waste_plans" ADD CONSTRAINT "site_waste_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "site_waste_plans" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_waste_plans_deny_all" ON "site_waste_plans" FOR ALL USING (false) WITH CHECK (false);
