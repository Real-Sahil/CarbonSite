-- Add hierarchical project support (sub-projects)
DO $$
BEGIN
  ALTER TABLE "projects" ADD COLUMN "parent_project_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_parent_project_id_fkey" FOREIGN KEY ("parent_project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "projects_parent_project_id_idx" ON "projects"("parent_project_id");

-- Add project-level facility support
DO $$
BEGIN
  ALTER TABLE "facilities" ADD COLUMN "project_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "facilities" ADD CONSTRAINT "facilities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "facilities_project_id_idx" ON "facilities"("project_id");

-- Add site zone/hierarchy support
DO $$
BEGIN
  ALTER TABLE "sites" ADD COLUMN "parent_site_id" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE "sites" ADD CONSTRAINT "sites_parent_site_id_fkey" FOREIGN KEY ("parent_site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "sites_parent_site_id_idx" ON "sites"("parent_site_id");
