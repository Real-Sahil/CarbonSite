-- CreateTable
CREATE TABLE "report_narratives" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "executive_summary" TEXT NOT NULL DEFAULT '',
    "key_findings" JSONB NOT NULL DEFAULT '[]',
    "recommendations" TEXT NOT NULL DEFAULT '',
    "ai_drafted" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_narratives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "report_narratives_organization_id_reporting_period_id_key" ON "report_narratives"("organization_id", "reporting_period_id");

-- AddForeignKey
ALTER TABLE "report_narratives" ADD CONSTRAINT "report_narratives_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_narratives" ADD CONSTRAINT "report_narratives_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_narratives" ADD CONSTRAINT "report_narratives_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Row level security: deny all (the app connects as postgres, which bypasses RLS)
ALTER TABLE "report_narratives" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_narratives_deny_all" ON "report_narratives" FOR ALL USING (false) WITH CHECK (false);
