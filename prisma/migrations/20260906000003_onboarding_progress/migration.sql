-- CreateTable: onboarding_progress
-- Tracks which setup steps an org's admin has completed.
-- Replaces the previously dropped onboarding_progress table (Phase 2 re-implementation).

CREATE TABLE "onboarding_progress" (
    "id"               TEXT NOT NULL,
    "organization_id"  TEXT NOT NULL,
    "completed_steps"  TEXT[] NOT NULL DEFAULT '{}',
    "is_complete"      BOOLEAN NOT NULL DEFAULT false,
    "completed_at"     TIMESTAMP(3),
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id")
);

-- UniqueIndex
CREATE UNIQUE INDEX "onboarding_progress_organization_id_key" ON "onboarding_progress"("organization_id");

-- FK to organizations
ALTER TABLE "onboarding_progress"
    ADD CONSTRAINT "onboarding_progress_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
