CREATE TABLE "field_worker_assignments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reporting_period_id" TEXT NOT NULL,
    "facility_id" TEXT,
    "assigned_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_worker_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "field_worker_assignments_organization_id_user_id_reporting_period_id_key"
ON "field_worker_assignments"("organization_id", "user_id", "reporting_period_id");

CREATE INDEX "field_worker_assignments_organization_id_user_id_idx"
ON "field_worker_assignments"("organization_id", "user_id");

CREATE INDEX "field_worker_assignments_organization_id_reporting_period_id_idx"
ON "field_worker_assignments"("organization_id", "reporting_period_id");

ALTER TABLE "field_worker_assignments"
ADD CONSTRAINT "field_worker_assignments_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "field_worker_assignments"
ADD CONSTRAINT "field_worker_assignments_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "field_worker_assignments"
ADD CONSTRAINT "field_worker_assignments_assigned_by_user_id_fkey"
FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "field_worker_assignments"
ADD CONSTRAINT "field_worker_assignments_reporting_period_id_fkey"
FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "field_worker_assignments"
ADD CONSTRAINT "field_worker_assignments_facility_id_fkey"
FOREIGN KEY ("facility_id") REFERENCES "facilities"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
