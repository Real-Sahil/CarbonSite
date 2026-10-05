-- CreateTable
CREATE TABLE "inventory_auditor_accesses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "engagement_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "company" TEXT,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_auditor_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_auditor_accesses_token_hash_key" ON "inventory_auditor_accesses"("token_hash");

-- CreateIndex
CREATE INDEX "inventory_auditor_accesses_organization_id_snapshot_id_idx" ON "inventory_auditor_accesses"("organization_id", "snapshot_id");

-- AddForeignKey
ALTER TABLE "inventory_auditor_accesses" ADD CONSTRAINT "inventory_auditor_accesses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security: the app connects as postgres, which bypasses it; nobody else may read tokens.
ALTER TABLE "inventory_auditor_accesses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_auditor_accesses_deny_all" ON "inventory_auditor_accesses" FOR ALL USING (false) WITH CHECK (false);
