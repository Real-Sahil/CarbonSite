-- Evidence verification and record seals. Additive only.
-- AlterTable
ALTER TABLE "evidence_files" ADD COLUMN     "verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "record_seals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "activity_record_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "seal_hash" TEXT NOT NULL,
    "previous_seal_hash" TEXT,
    "payload" JSONB NOT NULL,
    "sealed_by_user_id" TEXT,
    "sealed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_seals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "record_seals_organization_id_activity_record_id_idx" ON "record_seals"("organization_id", "activity_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "record_seals_activity_record_id_version_key" ON "record_seals"("activity_record_id", "version");

-- AddForeignKey
ALTER TABLE "record_seals" ADD CONSTRAINT "record_seals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "record_seals" ADD CONSTRAINT "record_seals_version_check" CHECK ("version" >= 1);
ALTER TABLE "record_seals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "record_seals_deny_all" ON "record_seals" FOR ALL USING (false) WITH CHECK (false);
