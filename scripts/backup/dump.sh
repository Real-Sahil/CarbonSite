#!/usr/bin/env bash
# Nightly database backup: the public schema (all application data, Better
# Auth, _prisma_migrations) as a pg_dump custom-format archive, encrypted with
# a passphrase (AES-256), plus a manifest of row counts per table that the
# restore drill checks against. Supabase's own schemas (auth, storage, cron,
# vault) are not included; the scheduler functions and cron entries are
# recreated by migrations.
#
# Env: DATABASE_URL (session-mode pooler or direct), BACKUP_PASSPHRASE,
#      OUT_DIR (default ./backup-out)
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is required}"
OUT_DIR="${OUT_DIR:-./backup-out}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT_DIR"

# Row counts first; the drill allows for rows written between count and dump.
psql "$DATABASE_URL" -X -A -t -F',' -v ON_ERROR_STOP=1 <<'SQL' > "$OUT_DIR/manifest-$STAMP.csv"
SELECT format('SELECT %L, count(*) FROM public.%I', tablename, tablename)
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
\gexec
SQL

pg_dump "$DATABASE_URL" --format=custom --compress=9 --no-owner --no-privileges \
  --schema=public --file="$OUT_DIR/metricora-$STAMP.dump"

gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 --symmetric --cipher-algo AES256 \
  --output "$OUT_DIR/metricora-$STAMP.dump.gpg" "$OUT_DIR/metricora-$STAMP.dump" 3<<<"$BACKUP_PASSPHRASE"
rm -f "$OUT_DIR/metricora-$STAMP.dump"

echo "$STAMP" > "$OUT_DIR/latest.txt"
echo "tables: $(wc -l < "$OUT_DIR/manifest-$STAMP.csv"), archive: $(du -h "$OUT_DIR/metricora-$STAMP.dump.gpg" | cut -f1)"
