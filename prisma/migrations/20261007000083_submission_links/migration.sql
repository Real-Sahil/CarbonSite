-- AlterTable
ALTER TABLE "bill_inbox_items" ADD COLUMN     "project_id" TEXT,
ADD COLUMN     "submission_link_id" TEXT,
ADD COLUMN     "uploader_company" TEXT,
ADD COLUMN     "uploader_name" TEXT,
ADD COLUMN     "uploader_note" TEXT;

-- CreateTable
CREATE TABLE "submission_links" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "project_id" TEXT,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6),
    "upload_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "submission_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "submission_links_token_hash_key" ON "submission_links"("token_hash");

-- CreateIndex
CREATE INDEX "submission_links_organization_id_created_at_idx" ON "submission_links"("organization_id", "created_at");

-- AddForeignKey
ALTER TABLE "submission_links" ADD CONSTRAINT "submission_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "submission_links" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "submission_links_deny_all" ON "submission_links" FOR ALL USING (false) WITH CHECK (false);
