-- Add hierarchical project support (sub-projects)
ALTER TABLE "projects" ADD COLUMN "parent_project_id" TEXT;
ALTER TABLE "projects" ADD CONSTRAINT "projects_parent_project_id_fkey" FOREIGN KEY ("parent_project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "projects_parent_project_id_idx" ON "projects"("parent_project_id");

-- Add project-level facility support
ALTER TABLE "facilities" ADD COLUMN "project_id" TEXT;
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "facilities_project_id_idx" ON "facilities"("project_id");

-- Add site zone/hierarchy support
ALTER TABLE "sites" ADD COLUMN "parent_site_id" TEXT;
ALTER TABLE "sites" ADD CONSTRAINT "sites_parent_site_id_fkey" FOREIGN KEY ("parent_site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "sites_parent_site_id_idx" ON "sites"("parent_site_id");
