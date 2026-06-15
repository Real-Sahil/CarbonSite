-- AlterTable: scope invite links to a site (nullable for backwards compatibility)
ALTER TABLE "invite_links" ADD COLUMN "site_id" TEXT;

-- CreateTable: field worker → site assignments (site-based onboarding)
CREATE TABLE "field_worker_site_assignments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "assigned_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_worker_site_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "field_worker_site_assignments_organization_id_user_id_idx" ON "field_worker_site_assignments"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "field_worker_site_assignments_organization_id_site_id_idx" ON "field_worker_site_assignments"("organization_id", "site_id");

-- CreateIndex
CREATE UNIQUE INDEX "field_worker_site_assignments_organization_id_user_id_site_i_key" ON "field_worker_site_assignments"("organization_id", "user_id", "site_id");

-- AddForeignKey
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_worker_site_assignments" ADD CONSTRAINT "field_worker_site_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_worker_site_assignments" ADD CONSTRAINT "field_worker_site_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_worker_site_assignments" ADD CONSTRAINT "field_worker_site_assignments_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_worker_site_assignments" ADD CONSTRAINT "field_worker_site_assignments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
