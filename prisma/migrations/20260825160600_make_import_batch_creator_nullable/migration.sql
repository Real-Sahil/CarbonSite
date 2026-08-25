-- Make ImportBatch.createdByUserId nullable to support system-generated imports (webhooks, connectors)

ALTER TABLE import_batches
ALTER COLUMN created_by_user_id DROP NOT NULL;
