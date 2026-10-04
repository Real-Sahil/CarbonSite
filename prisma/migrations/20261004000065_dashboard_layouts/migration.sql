
-- CreateTable
CREATE TABLE "dashboard_layouts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_key" TEXT NOT NULL,
    "surface" TEXT NOT NULL DEFAULT 'dashboard',
    "owner_user_id" TEXT,
    "layout" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_layouts_organization_id_surface_user_key_key" ON "dashboard_layouts"("organization_id", "surface", "user_key");

-- AddForeignKey
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security: deny all (the app connects as postgres, which bypasses RLS)
ALTER TABLE "dashboard_layouts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dashboard_layouts_deny_all" ON "dashboard_layouts" FOR ALL USING (false) WITH CHECK (false);
