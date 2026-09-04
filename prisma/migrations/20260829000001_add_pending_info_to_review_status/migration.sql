-- Add 'pending_info' value to ReviewStatus enum
--
-- Rewritten: the Postgres enum type is named "review_status" (its Prisma
-- @@map value), not "ReviewStatus" (the Prisma enum name) — the original
-- ALTER TYPE always failed with "type ReviewStatus does not exist".
ALTER TYPE "review_status" ADD VALUE 'pending_info' AFTER 'in_review';
