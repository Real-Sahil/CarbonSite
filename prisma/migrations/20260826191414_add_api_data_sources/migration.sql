-- CreateTable
CREATE TABLE "api_data_sources" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "endpoint" TEXT NOT NULL,
    "auth_method" TEXT NOT NULL DEFAULT 'none',
    "api_key" TEXT,
    "bearer_token" TEXT,
    "basic_username" TEXT,
    "basic_password" TEXT,
    "data_format" TEXT NOT NULL DEFAULT 'json',
    "mapping_config" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "last_error_at" TIMESTAMP(3),
    "last_error_message" TEXT,
    "sync_interval_mins" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_data_sources_organization_id_enabled_idx" ON "api_data_sources"("organization_id", "enabled");

-- CreateIndex
CREATE INDEX "api_data_sources_organization_id_last_sync_at_idx" ON "api_data_sources"("organization_id", "last_sync_at");

-- AddForeignKey
ALTER TABLE "api_data_sources" ADD CONSTRAINT "api_data_sources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
