-- CreateTable ReportVerificationToken
CREATE TABLE IF NOT EXISTS "report_verification_tokens" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "max_access_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex unique token
CREATE UNIQUE INDEX IF NOT EXISTS "report_verification_tokens_token_key" ON "report_verification_tokens"("token");

-- CreateIndex unique report_id (one token per report)
CREATE UNIQUE INDEX IF NOT EXISTS "report_verification_tokens_report_id_key" ON "report_verification_tokens"("report_id");

-- CreateIndex for queries by org and expiry
CREATE INDEX IF NOT EXISTS "report_verification_tokens_organization_id_expires_at_idx" ON "report_verification_tokens"("organization_id", "expires_at");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "report_verification_tokens" ADD CONSTRAINT "report_verification_tokens_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "report_verification_tokens" ADD CONSTRAINT "report_verification_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
