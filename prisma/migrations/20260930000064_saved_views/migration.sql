
-- CreateTable
CREATE TABLE "saved_views" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_views_organization_id_surface_shared_idx" ON "saved_views"("organization_id", "surface", "shared");

-- CreateIndex
CREATE UNIQUE INDEX "saved_views_organization_id_owner_user_id_surface_name_key" ON "saved_views"("organization_id", "owner_user_id", "surface", "name");

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security: deny all (the app connects as postgres, which bypasses RLS)
ALTER TABLE "saved_views" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_views_deny_all" ON "saved_views" FOR ALL USING (false) WITH CHECK (false);
