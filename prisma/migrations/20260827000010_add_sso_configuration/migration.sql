-- CreateTable SsoConfiguration
CREATE TABLE IF NOT EXISTS "sso_configurations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata_url" TEXT,
    "client_id" TEXT NOT NULL,
    "client_secret" TEXT NOT NULL,
    "idp_entity_id" TEXT,
    "sso_url" TEXT,
    "certificate_x509" TEXT,
    "auto_create_users" BOOLEAN NOT NULL DEFAULT true,
    "auto_assign_role" TEXT DEFAULT 'viewer',
    "require_mfa" BOOLEAN NOT NULL DEFAULT false,
    "sync_attributes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sso_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable SsoSession
CREATE TABLE IF NOT EXISTS "sso_sessions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "idp_session_id" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sso_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex on sso_configurations
CREATE UNIQUE INDEX IF NOT EXISTS "sso_configurations_organization_id_key" ON "sso_configurations"("organization_id");

-- CreateIndex on sso_sessions organization, user
CREATE INDEX IF NOT EXISTS "sso_sessions_organizationId_userId_idx" ON "sso_sessions"("organization_id", "user_id");

-- CreateIndex on sso_sessions provider
CREATE INDEX IF NOT EXISTS "sso_sessions_organizationId_provider_idx" ON "sso_sessions"("organization_id", "provider");

-- CreateIndex unique provider user
CREATE UNIQUE INDEX IF NOT EXISTS "sso_sessions_organizationId_providerUserId_key" ON "sso_sessions"("organization_id", "provider_user_id");

-- AddForeignKey for sso_configurations
DO $$
BEGIN
  ALTER TABLE "sso_configurations" ADD CONSTRAINT "sso_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey for sso_sessions to organizations
DO $$
BEGIN
  ALTER TABLE "sso_sessions" ADD CONSTRAINT "sso_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey for sso_sessions to users
DO $$
BEGIN
  ALTER TABLE "sso_sessions" ADD CONSTRAINT "sso_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
