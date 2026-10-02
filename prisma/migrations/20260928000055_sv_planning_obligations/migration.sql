-- CreateTable
CREATE TABLE "sv_planning_obligations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "site_id" TEXT,
    "contract_id" TEXT,
    "commitment_id" TEXT,
    "owner_user_id" TEXT,
    "title" TEXT NOT NULL,
    "reference" TEXT,
    "authority" TEXT,
    "clause" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "description" TEXT,
    "target_value" DECIMAL(18,2),
    "target_unit" TEXT,
    "due_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sv_planning_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sv_planning_obligations_organization_id_status_due_date_idx" ON "sv_planning_obligations"("organization_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "sv_planning_obligations_organization_id_site_id_idx" ON "sv_planning_obligations"("organization_id", "site_id");

-- AddForeignKey
ALTER TABLE "sv_planning_obligations" ADD CONSTRAINT "sv_planning_obligations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security: the app connects as postgres (bypasses RLS); no other role gets access.
ALTER TABLE "sv_planning_obligations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sv_planning_obligations_deny_all" ON "sv_planning_obligations" FOR ALL USING (false) WITH CHECK (false);
