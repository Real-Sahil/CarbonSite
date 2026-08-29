-- CreateTable "DbtRun"
CREATE TABLE "dbt_runs" (
    "id" TEXT NOT NULL,
    "calculation_run_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "dbt_command" TEXT NOT NULL,
    "dbt_output" TEXT,
    "rows_affected" INTEGER,
    "models_created" INTEGER,
    "test_count" INTEGER,
    "tests_passed" INTEGER,
    "tests_failed" INTEGER,
    "duration" INTEGER,
    "error_message" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dbt_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable "N8nWorkflow"
CREATE TABLE "n8n_workflows" (
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "n8n_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable "N8nExecution"
CREATE TABLE "n8n_executions" (
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

-- CreateIndex
CREATE UNIQUE INDEX "dbt_runs_calculation_run_id_key" ON "dbt_runs"("calculation_run_id");

-- CreateIndex
CREATE INDEX "dbt_runs_organization_id_idx" ON "dbt_runs"("organization_id");

-- CreateIndex
CREATE INDEX "dbt_runs_status_idx" ON "dbt_runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "n8n_workflows_n8n_workflow_id_key" ON "n8n_workflows"("n8n_workflow_id");

-- CreateIndex
CREATE INDEX "n8n_workflows_organization_id_idx" ON "n8n_workflows"("organization_id");

-- CreateIndex
CREATE INDEX "n8n_workflows_trigger_action_idx" ON "n8n_workflows"("trigger", "action");

-- CreateIndex
CREATE INDEX "n8n_executions_workflow_id_idx" ON "n8n_executions"("workflow_id");

-- CreateIndex
CREATE INDEX "n8n_executions_organization_id_idx" ON "n8n_executions"("organization_id");

-- CreateIndex
CREATE INDEX "n8n_executions_status_idx" ON "n8n_executions"("status");

-- CreateIndex
CREATE INDEX "n8n_executions_triggered_at_idx" ON "n8n_executions"("triggered_at");

-- AddForeignKey
ALTER TABLE "dbt_runs" ADD CONSTRAINT "dbt_runs_calculation_run_id_fkey" FOREIGN KEY ("calculation_run_id") REFERENCES "calculation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dbt_runs" ADD CONSTRAINT "dbt_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "n8n_workflows" ADD CONSTRAINT "n8n_workflows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "n8n_executions" ADD CONSTRAINT "n8n_executions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "n8n_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "n8n_executions" ADD CONSTRAINT "n8n_executions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
