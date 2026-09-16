-- AddColumn error_message to reports table
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "error_message" TEXT;
