-- CreateTable
CREATE TABLE "report_layouts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "blocks" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "report_layouts_organization_id_report_type_key" ON "report_layouts"("organization_id", "report_type");

-- AddForeignKey
ALTER TABLE "report_layouts" ADD CONSTRAINT "report_layouts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "report_layouts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report_layouts_deny_all" ON "report_layouts" FOR ALL USING (false) WITH CHECK (false);
