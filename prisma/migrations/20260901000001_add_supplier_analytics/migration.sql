-- CreateTable supplier_analytics
CREATE TABLE "supplier_analytics" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "submission_count" INTEGER NOT NULL DEFAULT 0,
    "approval_rate" NUMERIC(3,2) NOT NULL DEFAULT 0,
    "completeness_score" NUMERIC(3,2) NOT NULL DEFAULT 0,
    "timeliness_score" NUMERIC(3,2) NOT NULL DEFAULT 0,
    "overall_score" NUMERIC(5,2) NOT NULL DEFAULT 0,
    "trend" TEXT NOT NULL DEFAULT 'stable',
    "previous_score" NUMERIC(5,2) NOT NULL,
    "score_change" NUMERIC(5,2) NOT NULL,
    "forecasted_emissions" NUMERIC(15,2) NOT NULL,
    "forecast_confidence" NUMERIC(3,2) NOT NULL,
    "last_anomaly_detected" TIMESTAMP(3),
    "anomaly_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_analytics_organization_id_supplier_id_key" ON "supplier_analytics"("organization_id", "supplier_id");

-- CreateIndex
CREATE INDEX "supplier_analytics_organization_id_overall_score_idx" ON "supplier_analytics"("organization_id", "overall_score" DESC);

-- CreateIndex
CREATE INDEX "supplier_analytics_organization_id_trend_idx" ON "supplier_analytics"("organization_id", "trend");

-- CreateIndex
CREATE INDEX "supplier_analytics_organization_id_updated_at_idx" ON "supplier_analytics"("organization_id", "updated_at" DESC);

-- AddForeignKey
ALTER TABLE "supplier_analytics" ADD CONSTRAINT "supplier_analytics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_analytics" ADD CONSTRAINT "supplier_analytics_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
