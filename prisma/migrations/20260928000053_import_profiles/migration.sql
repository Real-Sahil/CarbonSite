-- ERP export profiles: column mapping plus ledger account / cost code rules per org.
-- Additive only: two new tables and two nullable columns on import_batches.

-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN     "import_profile_id" TEXT,
ADD COLUMN     "profile_snapshot" JSONB;

-- CreateTable
CREATE TABLE "import_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_system" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "date_format" TEXT NOT NULL DEFAULT 'dmy',
    "number_format" TEXT NOT NULL DEFAULT 'uk',
    "default_currency" TEXT NOT NULL DEFAULT 'GBP',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_profile_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "import_profile_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "account" TEXT,
    "cost_code" TEXT,
    "action" TEXT NOT NULL,
    "category_code" TEXT,
    "basis" TEXT NOT NULL DEFAULT 'spend',
    "unit" TEXT,
    "industry_code" TEXT,
    "fuel_type" TEXT,
    "facility_name" TEXT,
    "note" TEXT,

    CONSTRAINT "import_profile_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "import_profiles_organization_id_name_key" ON "import_profiles"("organization_id", "name");

-- CreateIndex
CREATE INDEX "import_profile_rules_organization_id_import_profile_id_posi_idx" ON "import_profile_rules"("organization_id", "import_profile_id", "position");

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_import_profile_id_fkey" FOREIGN KEY ("import_profile_id") REFERENCES "import_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_profiles" ADD CONSTRAINT "import_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_profile_rules" ADD CONSTRAINT "import_profile_rules_import_profile_id_fkey" FOREIGN KEY ("import_profile_id") REFERENCES "import_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security: the app connects as postgres; nothing else reads these.
ALTER TABLE "import_profiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_profiles_deny_all" ON "import_profiles" FOR ALL USING (false) WITH CHECK (false);
ALTER TABLE "import_profile_rules" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_profile_rules_deny_all" ON "import_profile_rules" FOR ALL USING (false) WITH CHECK (false);
