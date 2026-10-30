-- CreateTable
CREATE TABLE "perf_samples" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "total_ms" INTEGER NOT NULL,
    "stages" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perf_samples_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "perf_samples_page_created_at_idx" ON "perf_samples"("page", "created_at");

-- CreateIndex
CREATE INDEX "perf_samples_organization_id_created_at_idx" ON "perf_samples"("organization_id", "created_at");

-- AddForeignKey
ALTER TABLE "perf_samples" ADD CONSTRAINT "perf_samples_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "perf_samples" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_samples_deny_all" ON "perf_samples" FOR ALL USING (false) WITH CHECK (false);
