-- Phase 2: Custom Emission Factors, Supplier Anomaly Detection, Zapier Integration

-- CreateTable organization_emission_factors
CREATE TABLE "organization_emission_factors" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "scope" INTEGER NOT NULL,
    "emission_category_id" TEXT,
    "activity_type" TEXT,
    "geography_country" TEXT,
    "geography_region" TEXT,
    "effective_start_date" DATE,
    "effective_end_date" DATE,
    "input_unit" TEXT NOT NULL,
    "co2" NUMERIC(18,8),
    "ch4" NUMERIC(18,8),
    "n2o" NUMERIC(18,8),
    "co2e" NUMERIC(18,8),
    "uncertainty_rating" TEXT,
    "usage_notes" TEXT,
    "source" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_emission_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable supplier_anomalies
CREATE TABLE "supplier_anomalies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "supplier_data_request_id" TEXT NOT NULL,
    "anomaly_score" NUMERIC(5,4) NOT NULL,
    "anomaly_severity" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "flagged_fields" JSONB NOT NULL,
    "historical_average" NUMERIC(18,8),
    "historical_std_dev" NUMERIC(18,8),
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by_user_id" TEXT,
    "acknowledged_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateTable zapier_integrations
CREATE TABLE "zapier_integrations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "zapier_custom_id" TEXT NOT NULL,
    "encrypted_secret" TEXT NOT NULL,
    "trigger_event_types" TEXT[],
    "action_types" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_webhook_at" TIMESTAMP(3),
    "last_error_at" TIMESTAMP(3),
    "last_error_message" TEXT,
    "install_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zapier_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_emission_factors_organization_id_scope_emission_ca_key" ON "organization_emission_factors"("organization_id", "scope", "emission_category_id", "activity_type", "geography_country", "geography_region", "input_unit", "version");

CREATE INDEX "organization_emission_factors_organization_id_scope_emission_ca_idx" ON "organization_emission_factors"("organization_id", "scope", "emission_category_id");

CREATE INDEX "organization_emission_factors_organization_id_effective_start__idx" ON "organization_emission_factors"("organization_id", "effective_start_date", "effective_end_date");

CREATE INDEX "supplier_anomalies_organization_id_anomaly_severity_idx" ON "supplier_anomalies"("organization_id", "anomaly_severity");

CREATE INDEX "supplier_anomalies_organization_id_detected_at_idx" ON "supplier_anomalies"("organization_id", "detected_at");

CREATE INDEX "supplier_anomalies_supplier_data_request_id_idx" ON "supplier_anomalies"("supplier_data_request_id");

CREATE UNIQUE INDEX "zapier_integrations_zapier_custom_id_key" ON "zapier_integrations"("zapier_custom_id");

CREATE UNIQUE INDEX "zapier_integrations_organization_id_key" ON "zapier_integrations"("organization_id");

-- AddForeignKey
ALTER TABLE "organization_emission_factors" ADD CONSTRAINT "organization_emission_factors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_emission_factors" ADD CONSTRAINT "organization_emission_factors_emission_category_id_fkey" FOREIGN KEY ("emission_category_id") REFERENCES "emission_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "organization_emission_factors" ADD CONSTRAINT "organization_emission_factors_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_anomalies" ADD CONSTRAINT "supplier_anomalies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_anomalies" ADD CONSTRAINT "supplier_anomalies_supplier_data_request_id_fkey" FOREIGN KEY ("supplier_data_request_id") REFERENCES "supplier_data_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_anomalies" ADD CONSTRAINT "supplier_anomalies_acknowledged_by_user_id_fkey" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "zapier_integrations" ADD CONSTRAINT "zapier_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
