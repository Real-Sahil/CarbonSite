-- Tamper-evident audit log: per-organization SHA-256 hash chain, plus
-- IP address / user agent capture for security investigations.
ALTER TABLE "audit_logs"
    ADD COLUMN IF NOT EXISTS "ip_address"   TEXT,
    ADD COLUMN IF NOT EXISTS "user_agent"   TEXT,
    ADD COLUMN IF NOT EXISTS "previous_hash" TEXT,
    ADD COLUMN IF NOT EXISTS "hash"          TEXT,
    ADD COLUMN IF NOT EXISTS "chain_seq"     BIGSERIAL;

CREATE INDEX IF NOT EXISTS "audit_logs_organization_id_chain_seq_idx"
    ON "audit_logs"("organization_id", "chain_seq");
