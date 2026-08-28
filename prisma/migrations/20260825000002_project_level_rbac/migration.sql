-- Add project-level role assignments for granular access control
CREATE TABLE "project_role_assignments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "assigned_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_role_assignments_pkey" PRIMARY KEY ("id")
);

-- Create indexes for efficient lookups
CREATE UNIQUE INDEX "project_role_assignments_user_id_project_id_key" ON "project_role_assignments"("user_id", "project_id");
CREATE INDEX "project_role_assignments_organization_id_idx" ON "project_role_assignments"("organization_id");
CREATE INDEX "project_role_assignments_user_id_idx" ON "project_role_assignments"("user_id");
CREATE INDEX "project_role_assignments_project_id_idx" ON "project_role_assignments"("project_id");
CREATE INDEX "project_role_assignments_assigned_by_user_id_idx" ON "project_role_assignments"("assigned_by_user_id");

-- Add foreign keys
ALTER TABLE "project_role_assignments" ADD CONSTRAINT "project_role_assignments_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_role_assignments" ADD CONSTRAINT "project_role_assignments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_role_assignments" ADD CONSTRAINT "project_role_assignments_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_role_assignments" ADD CONSTRAINT "project_role_assignments_assigned_by_user_id_fkey"
  FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
