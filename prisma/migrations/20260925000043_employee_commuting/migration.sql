-- Employee commuting from site attendance (distance-based, GHG Protocol
-- Scope 3 Category 7) and anonymous per-site travel surveys.

-- CreateTable
CREATE TABLE "commute_surveys" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commute_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commute_survey_responses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "survey_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "occupancy" INTEGER NOT NULL DEFAULT 1,
    "workforce" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commute_survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commute_imports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "evidence_file_id" TEXT NOT NULL,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "record_ids" TEXT[],
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commute_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commute_surveys_token_key" ON "commute_surveys"("token");

-- CreateIndex
CREATE UNIQUE INDEX "commute_surveys_organization_id_site_id_key" ON "commute_surveys"("organization_id", "site_id");

-- CreateIndex
CREATE INDEX "commute_survey_responses_organization_id_survey_id_idx" ON "commute_survey_responses"("organization_id", "survey_id");

-- CreateIndex
CREATE UNIQUE INDEX "commute_imports_organization_id_site_id_month_key" ON "commute_imports"("organization_id", "site_id", "month");

-- AddForeignKey
ALTER TABLE "commute_surveys" ADD CONSTRAINT "commute_surveys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commute_surveys" ADD CONSTRAINT "commute_surveys_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commute_survey_responses" ADD CONSTRAINT "commute_survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "commute_surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commute_imports" ADD CONSTRAINT "commute_imports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commute_imports" ADD CONSTRAINT "commute_imports_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commute_imports" ADD CONSTRAINT "commute_imports_evidence_file_id_fkey" FOREIGN KEY ("evidence_file_id") REFERENCES "evidence_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "commute_surveys" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commute_surveys_deny_all" ON "commute_surveys" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "commute_survey_responses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commute_survey_responses_deny_all" ON "commute_survey_responses" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "commute_imports" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commute_imports_deny_all" ON "commute_imports" FOR ALL USING (false) WITH CHECK (false);
