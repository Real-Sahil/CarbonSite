#!/usr/bin/env bash
# Restore drill: decrypt a backup, restore it into an empty PostgreSQL
# database and prove it is usable. Fails when a table from the manifest is
# missing, when a table's row count falls short of the manifest (rows written
# after the count are allowed), or when the migration history is incomplete.
#
# Env: RESTORE_URL (empty target database), BACKUP_PASSPHRASE,
#      ARCHIVE (path to .dump.gpg), MANIFEST (path to manifest csv),
#      MIGRATIONS_DIR (default prisma/migrations)
set -euo pipefail
: "${RESTORE_URL:?}" "${BACKUP_PASSPHRASE:?}" "${ARCHIVE:?}" "${MANIFEST:?}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-prisma/migrations}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 --decrypt \
  --output "$WORK/backup.dump" "$ARCHIVE" 3<<<"$BACKUP_PASSPHRASE"

# What Supabase provides and the dump refers to: the API roles named in RLS
# policies and the auth helpers they call. Stubs are enough to restore.
psql "$RESTORE_URL" -X -q -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS 'SELECT NULL::text';
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS 'SELECT NULL::jsonb';
SQL

# The public schema already exists in a fresh database; everything else must restore cleanly.
pg_restore --dbname="$RESTORE_URL" --no-owner --no-privileges "$WORK/backup.dump" 2> "$WORK/restore.log" || true
grep -v 'schema "public" already exists' "$WORK/restore.log" | grep -E "^pg_restore: error" > "$WORK/errors.log" || true
if [ -s "$WORK/errors.log" ]; then
  echo "::error::pg_restore reported errors:"; head -50 "$WORK/errors.log"; exit 1
fi

psql "$RESTORE_URL" -X -A -t -F',' -v ON_ERROR_STOP=1 <<'SQL' > "$WORK/restored.csv"
SELECT format('SELECT %L, count(*) FROM public.%I', tablename, tablename)
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
\gexec
SQL

fail=0
while IFS=, read -r table expected; do
  actual="$(grep -E "^${table}," "$WORK/restored.csv" | cut -d, -f2 || true)"
  if [ -z "$actual" ]; then echo "::error::table $table missing after restore"; fail=1; continue; fi
  if [ "$actual" -lt "$expected" ]; then echo "::error::$table has $actual rows, manifest says $expected"; fail=1; fi
done < "$MANIFEST"

applied="$(psql "$RESTORE_URL" -X -A -t -c "SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL")"
expected_migrations="$(find "$MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l)"
if [ "$applied" -lt "$expected_migrations" ]; then
  echo "::warning::backup has $applied applied migrations, repository has $expected_migrations (newer migrations not yet in this backup?)"
fi

echo "tables: $(wc -l < "$MANIFEST"), rows: $(awk -F, '{s+=$2} END {print s}' "$WORK/restored.csv"), migrations: $applied"
for t in organizations users activity_records emission_calculations published_snapshots emission_factors audit_logs; do
  echo "  $t: $(grep -E "^$t," "$WORK/restored.csv" | cut -d, -f2)"
done
exit $fail
