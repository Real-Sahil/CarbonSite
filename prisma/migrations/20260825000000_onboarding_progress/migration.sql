-- CreateTable
CREATE TABLE IF NOT EXISTS "onboarding_progress" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "step_state" JSONB NOT NULL DEFAULT '{}',
    "state" TEXT NOT NULL DEFAULT 'not_started',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_progress_organization_id_key" ON "onboarding_progress"("organization_id");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
