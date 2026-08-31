-- CreateTable scope3_estimation_models
CREATE TABLE IF NOT EXISTS "scope3_estimation_models" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "emission_category_id" TEXT NOT NULL,
    "facility_type" TEXT,
    "model_type" TEXT NOT NULL DEFAULT 'linear-regression',
    "training_record_count" INTEGER NOT NULL,
    "coefficients" JSONB NOT NULL,
    "model_metrics" JSONB NOT NULL,
    "feature_importance" JSONB NOT NULL,
    "training_data_date_range" JSONB NOT NULL,
    "confidence_threshold" NUMERIC(3,2) NOT NULL DEFAULT 0.7,
    "last_trained_at" TIMESTAMP(3) NOT NULL,
    "next_train_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scope3_estimation_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable scope3_estimates
CREATE TABLE IF NOT EXISTS "scope3_estimates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "facility_id" TEXT,
    "emission_category_id" TEXT NOT NULL,
    "estimation_model_id" TEXT NOT NULL,
    "estimated_value" NUMERIC(18,6) NOT NULL,
    "estimated_unit" TEXT NOT NULL,
    "confidence_score" NUMERIC(3,2) NOT NULL,
    "confidence_interval" JSONB NOT NULL,
    "model_inputs" JSONB NOT NULL,
    "prediction_explanation" TEXT,
    "based_on_record_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "accepted_at" TIMESTAMP(3),
    "accepted_by_user_id" TEXT,
    "rejection_reason" TEXT,
    "activity_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scope3_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex scope3_estimation_models_organization_id_emission_category_id_facility_type_key
CREATE UNIQUE INDEX IF NOT EXISTS "scope3_estimation_models_organization_id_emission_category_id_facility_type_key" ON "scope3_estimation_models"("organization_id", "emission_category_id", "facility_type");

-- CreateIndex scope3_estimation_models_organization_id_last_trained_at_idx
CREATE INDEX IF NOT EXISTS "scope3_estimation_models_organization_id_last_trained_at_idx" ON "scope3_estimation_models"("organization_id", "last_trained_at");

-- CreateIndex scope3_estimates_organization_id_emission_category_id_status_idx
CREATE INDEX IF NOT EXISTS "scope3_estimates_organization_id_emission_category_id_status_idx" ON "scope3_estimates"("organization_id", "emission_category_id", "status");

-- CreateIndex scope3_estimates_organization_id_created_at_idx
CREATE INDEX IF NOT EXISTS "scope3_estimates_organization_id_created_at_idx" ON "scope3_estimates"("organization_id", "created_at" DESC);

-- CreateIndex scope3_estimates_estimation_model_id_idx
CREATE INDEX IF NOT EXISTS "scope3_estimates_estimation_model_id_idx" ON "scope3_estimates"("estimation_model_id");

-- AddForeignKey scope3_estimation_models -> organizations
ALTER TABLE "scope3_estimation_models" ADD CONSTRAINT "scope3_estimation_models_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey scope3_estimation_models -> emission_categories
ALTER TABLE "scope3_estimation_models" ADD CONSTRAINT "scope3_estimation_models_emission_category_id_fkey" FOREIGN KEY ("emission_category_id") REFERENCES "emission_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey scope3_estimates -> organizations
ALTER TABLE "scope3_estimates" ADD CONSTRAINT "scope3_estimates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey scope3_estimates -> emission_categories
ALTER TABLE "scope3_estimates" ADD CONSTRAINT "scope3_estimates_emission_category_id_fkey" FOREIGN KEY ("emission_category_id") REFERENCES "emission_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey scope3_estimates -> scope3_estimation_models
ALTER TABLE "scope3_estimates" ADD CONSTRAINT "scope3_estimates_estimation_model_id_fkey" FOREIGN KEY ("estimation_model_id") REFERENCES "scope3_estimation_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey scope3_estimates -> users
ALTER TABLE "scope3_estimates" ADD CONSTRAINT "scope3_estimates_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey scope3_estimates -> activity_records
ALTER TABLE "scope3_estimates" ADD CONSTRAINT "scope3_estimates_activity_record_id_fkey" FOREIGN KEY ("activity_record_id") REFERENCES "activity_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
