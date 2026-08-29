-- Add 'pending_info' value to ReviewStatus enum
ALTER TYPE "ReviewStatus" ADD VALUE 'pending_info' AFTER 'in_review';
