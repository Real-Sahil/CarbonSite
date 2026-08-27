-- Add n8n workflow orchestration tracking tables

-- N8nWorkflow: Tracks n8n workflows configured for this org
CREATE TABLE IF NOT EXISTS "n8n_workflows" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  n8n_workflow_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(100) NOT NULL, -- 'field_submission_pending', 'emission_threshold_reached', 'report_ready', 'daily_digest'
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  webhook_url VARCHAR(500),
  config JSONB, -- trigger config, filter conditions, output mapping
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, n8n_workflow_id)
);

-- Indexes for common queries
CREATE INDEX "idx_n8n_workflows_org_trigger"
  ON "n8n_workflows"(organization_id, trigger_type, enabled);

CREATE INDEX "idx_n8n_workflows_org_created"
  ON "n8n_workflows"(organization_id, created_at DESC);

-- N8nWorkflowExecution: Audit trail of workflow runs
CREATE TABLE IF NOT EXISTS "n8n_workflow_executions" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "organizations"(id) ON DELETE CASCADE,
  n8n_workflow_id VARCHAR(255) NOT NULL,
  workflow_name VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(100) NOT NULL,
  trigger_data JSONB, -- data that triggered the workflow (e.g., submission_id, facility_id)
  status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'partial'
  error_message TEXT,
  output JSONB, -- workflow output/results
  execution_time_ms INT,
  executed_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for audit trail queries
CREATE INDEX "idx_n8n_workflow_executions_org_workflow"
  ON "n8n_workflow_executions"(organization_id, n8n_workflow_id);

CREATE INDEX "idx_n8n_workflow_executions_org_trigger"
  ON "n8n_workflow_executions"(organization_id, trigger_type);

CREATE INDEX "idx_n8n_workflow_executions_org_status"
  ON "n8n_workflow_executions"(organization_id, status);

CREATE INDEX "idx_n8n_workflow_executions_executed"
  ON "n8n_workflow_executions"(organization_id, executed_at DESC);
