-- Add field_submission to review_task_type so bulk-assign can create
-- correctly-typed review tasks for field submissions (previously mislabeled
-- as activity_record, producing broken task links).
ALTER TYPE "review_task_type" ADD VALUE IF NOT EXISTS 'field_submission';
