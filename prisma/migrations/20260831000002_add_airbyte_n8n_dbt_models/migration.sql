-- CreateTable "N8nWorkflow" (if not exists - may already exist from 20260827_add_n8n_workflows)
CREATE TABLE IF NOT EXISTS "n8n_workflows" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "n8n_workflow_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "n8n_webhook_url" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_triggered_at" TIMESTAMP(3),
    "last_execution_status" TEXT,
    "execution_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "n8n_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable "N8nExecution"
CREATE TABLE IF NOT EXISTS "n8n_executions" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "n8n_execution_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "execution_time" INTEGER,
    "output" JSONB,
    "error" TEXT,
    "triggered_by" TEXT,
    "triggered_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "n8n_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (safe - IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS "n8n_workflows_n8n_workflow_id_key" ON "n8n_workflows"("n8n_workflow_id");
CREATE INDEX IF NOT EXISTS "n8n_workflows_organization_id_idx" ON "n8n_workflows"("organization_id");
CREATE INDEX IF NOT EXISTS "n8n_workflows_trigger_action_idx" ON "n8n_workflows"("trigger", "action");
CREATE INDEX IF NOT EXISTS "n8n_executions_workflow_id_idx" ON "n8n_executions"("workflow_id");
CREATE INDEX IF NOT EXISTS "n8n_executions_organization_id_idx" ON "n8n_executions"("organization_id");
CREATE INDEX IF NOT EXISTS "n8n_executions_status_idx" ON "n8n_executions"("status");
CREATE INDEX IF NOT EXISTS "n8n_executions_triggered_at_idx" ON "n8n_executions"("triggered_at");

-- AddForeignKey (drop first to avoid duplicate constraint errors)
ALTER TABLE "n8n_workflows" DROP CONSTRAINT IF EXISTS "n8n_workflows_organization_id_fkey";
ALTER TABLE "n8n_workflows" ADD CONSTRAINT "n8n_workflows_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "n8n_executions" DROP CONSTRAINT IF EXISTS "n8n_executions_workflow_id_fkey";
ALTER TABLE "n8n_executions" ADD CONSTRAINT "n8n_executions_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "n8n_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "n8n_executions" DROP CONSTRAINT IF EXISTS "n8n_executions_organization_id_fkey";
ALTER TABLE "n8n_executions" ADD CONSTRAINT "n8n_executions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
