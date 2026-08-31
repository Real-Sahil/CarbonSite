-- CreateTable AuditContext
CREATE TABLE IF NOT EXISTS "audit_contexts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "audit_log_id" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "context_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex on organization_id, framework, resource_type, resource_id
CREATE INDEX IF NOT EXISTS "audit_contexts_organizationId_framework_resourceType_resourceId_idx" ON "audit_contexts"("organization_id", "framework", "resource_type", "resource_id");

-- CreateIndex on organization_id, audit_log_id
CREATE INDEX IF NOT EXISTS "audit_contexts_organizationId_auditLogId_idx" ON "audit_contexts"("organization_id", "audit_log_id");

-- AddForeignKey
ALTER TABLE "audit_contexts" ADD CONSTRAINT "audit_contexts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_contexts" ADD CONSTRAINT "audit_contexts_audit_log_id_fkey" FOREIGN KEY ("audit_log_id") REFERENCES "audit_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
