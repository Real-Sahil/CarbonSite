-- Review claim/lock: prevent two reviewers from concurrently working the same submission.
-- Stale timeout enforced in application code (5 minutes).
ALTER TABLE field_submissions
  ADD COLUMN IF NOT EXISTS review_claimed_by_user_id TEXT,
  ADD COLUMN IF NOT EXISTS review_claimed_at TIMESTAMPTZ;

-- Shareable snapshot link: time-limited token for read-only access with no login.
ALTER TABLE published_snapshots
  ADD COLUMN IF NOT EXISTS share_token TEXT,
  ADD COLUMN IF NOT EXISTS share_token_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS published_snapshots_share_token_key
  ON published_snapshots (share_token)
  WHERE share_token IS NOT NULL;

-- Data retention policy: org-level config for field submission evidence lifecycle.
-- NULL = keep forever (default). Value in days.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS evidence_retention_days INTEGER,
  ADD COLUMN IF NOT EXISTS evidence_retention_notified_at TIMESTAMPTZ;

-- Index for SLA query: find submissions pending review beyond a deadline.
CREATE INDEX IF NOT EXISTS idx_field_submissions_sla
  ON field_submissions (organization_id, status, submitted_at)
  WHERE status IN ('submitted', 'under_review');
