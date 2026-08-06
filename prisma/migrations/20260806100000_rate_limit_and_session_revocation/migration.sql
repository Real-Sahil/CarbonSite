-- FIND-001: Postgres-backed rate limit counters (replaces in-memory Map).
-- Fixed-window counters; atomically reset when reset_at elapses.
CREATE TABLE rate_limit_buckets (
  key        TEXT        PRIMARY KEY,
  count      INTEGER     NOT NULL DEFAULT 0,
  reset_at   TIMESTAMPTZ NOT NULL
);

-- FIND-003: Session revocation support.
-- NULL = active; non-NULL = revoked at that timestamp.
ALTER TABLE sessions
  ADD COLUMN revoked_at TIMESTAMPTZ;
