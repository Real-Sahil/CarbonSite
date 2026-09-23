-- Framework datapoints are shared reference rows, but their public narrative
-- was stored on the shared row, so one organisation's disclosure text
-- overwrote every other organisation's. Store it per organisation instead.
-- framework_datapoints.public_narrative is no longer read or written; it was
-- empty in production and can be dropped in a later contract step.

-- CreateTable
CREATE TABLE "organization_datapoint_narratives" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "datapoint_id" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "updated_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_datapoint_narratives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_datapoint_narratives_organization_id_datapoint_key" ON "organization_datapoint_narratives"("organization_id", "datapoint_id");

-- AddForeignKey
ALTER TABLE "organization_datapoint_narratives" ADD CONSTRAINT "organization_datapoint_narratives_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_datapoint_narratives" ADD CONSTRAINT "organization_datapoint_narratives_datapoint_id_fkey" FOREIGN KEY ("datapoint_id") REFERENCES "framework_datapoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same deny-all posture as every other tenant table: the app connects as
-- postgres (bypasses RLS); nothing else may read or write it.
ALTER TABLE "organization_datapoint_narratives" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organization_datapoint_narratives_deny_all" ON "organization_datapoint_narratives" FOR ALL USING (false) WITH CHECK (false);
