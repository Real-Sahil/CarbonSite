-- Supplier data request links: store only a SHA-256 of the link token.
-- Before: supplier_data_requests.token held the raw token and was the lookup key.
-- After: token_hash holds sha256(token) as hex and every lookup uses it. The plaintext
-- token column is only made nullable here; new rows leave it null. It is cleared and
-- dropped in a later release, which needs its own `-- contract-step:` line.
-- Existing links keep working: the backfill below hashes the stored raw value.

-- AlterTable
ALTER TABLE "supplier_data_requests" ADD COLUMN     "token_hash" TEXT,
ALTER COLUMN "token" DROP NOT NULL;

-- Backfill: the same digest hashToken() computes in the application (SHA-256 of the UTF-8 token, hex).
UPDATE "supplier_data_requests"
SET "token_hash" = encode(sha256(convert_to("token", 'UTF8')), 'hex')
WHERE "token" IS NOT NULL AND "token_hash" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "supplier_data_requests_token_hash_key" ON "supplier_data_requests"("token_hash");
