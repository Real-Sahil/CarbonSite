-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "bill_inbox_token" TEXT;

-- CreateTable
CREATE TABLE "bill_inbox_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "evidence_file_id" TEXT NOT NULL,
    "email_id" TEXT NOT NULL,
    "from_address" TEXT NOT NULL,
    "sender_user_id" TEXT,
    "subject" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "bill_inbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bill_inbox_items_organization_id_status_received_at_idx" ON "bill_inbox_items"("organization_id", "status", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "bill_inbox_items_organization_id_email_id_evidence_file_id_key" ON "bill_inbox_items"("organization_id", "email_id", "evidence_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_bill_inbox_token_key" ON "organizations"("bill_inbox_token");

-- AddForeignKey
ALTER TABLE "bill_inbox_items" ADD CONSTRAINT "bill_inbox_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_inbox_items" ADD CONSTRAINT "bill_inbox_items_evidence_file_id_fkey" FOREIGN KEY ("evidence_file_id") REFERENCES "evidence_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Deny-all: the app reaches this table through Prisma only.
ALTER TABLE "bill_inbox_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bill_inbox_items_deny_all" ON "bill_inbox_items" FOR ALL USING (false) WITH CHECK (false);
