-- Postgres-backed storage driver for deployments without an S3-compatible
-- bucket. Evidence photos and report artefacts persist here instead of the
-- ephemeral serverless filesystem.
CREATE TABLE IF NOT EXISTS "storage_objects" (
    "key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_objects_pkey" PRIMARY KEY ("key")
);
