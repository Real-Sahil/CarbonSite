-- CreateTable "IntegrationConfig"
CREATE TABLE "integration_configs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "llm_provider" TEXT,
    "llm_token" TEXT,
    "llm_token_validated_at" TIMESTAMP(3),
    "llm_token_valid" BOOLEAN NOT NULL DEFAULT false,
    "xero_client_id" TEXT,
    "xero_client_secret" TEXT,
    "xero_connected" BOOLEAN NOT NULL DEFAULT false,
    "xero_connected_at" TIMESTAMP(3),
    "xero_tenant_id" TEXT,
    "xero_refresh_token" TEXT,
    "xero_token_expires_at" TIMESTAMP(3),
    "oidc_provider" TEXT,
    "oidc_client_id" TEXT,
    "oidc_client_secret" TEXT,
    "oidc_issuer_url" TEXT,
    "oidc_discovery_validated_at" TIMESTAMP(3),
    "oidc_discovery_valid" BOOLEAN NOT NULL DEFAULT false,
    "n8n_webhook_reports" TEXT,
    "n8n_webhook_reports_tested" BOOLEAN NOT NULL DEFAULT false,
    "n8n_webhook_submissions" TEXT,
    "n8n_webhook_submissions_tested" BOOLEAN NOT NULL DEFAULT false,
    "last_tested_at" TIMESTAMP(3),
    "test_results" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_configs_organization_id_key" ON "integration_configs"("organization_id");

-- CreateIndex
CREATE INDEX "integration_configs_organization_id_idx" ON "integration_configs"("organization_id");

-- AddForeignKey
ALTER TABLE "integration_configs" ADD CONSTRAINT "integration_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
