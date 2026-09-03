-- CreateTable notifications
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "resource_id" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_organization_id_read_at_created_at_idx" ON "notifications"("user_id", "organization_id", "read_at", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_organization_id_created_at_idx" ON "notifications"("user_id", "organization_id", "created_at" DESC);
