#!/usr/bin/env bash
# Supabase Storage helpers for the backup workflow, over the Storage REST API
# with the service role key. Source this file, then call:
#   storage_put <local file> <object path>
#   storage_get <object path> <local file>
#   storage_prune <prefix> <days>   delete objects under prefix older than days
#
# Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BACKUP_BUCKET (default backups)
set -euo pipefail
: "${SUPABASE_URL:?SUPABASE_URL is required}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required}"
BACKUP_BUCKET="${BACKUP_BUCKET:-backups}"
STORAGE_API="${SUPABASE_URL%/}/storage/v1"

_storage_curl() {
  curl --fail-with-body -sS --retry 3 --retry-all-errors \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" "$@"
}

storage_put() {
  _storage_curl -X POST -H "x-upsert: true" -H "Content-Type: application/octet-stream" \
    --data-binary "@$1" "$STORAGE_API/object/$BACKUP_BUCKET/$2" > /dev/null
}

storage_get() {
  _storage_curl -o "$2" "$STORAGE_API/object/authenticated/$BACKUP_BUCKET/$1"
}

# Names carry a UTC stamp (metricora-20260924T023000Z.dump.gpg), so age is
# read from the name, not from upload metadata.
storage_prune() {
  local prefix="$1" days="$2" cutoff names
  cutoff="$(date -u -d "-$days days" +%Y%m%d)"
  names="$(_storage_curl -X POST -H "Content-Type: application/json" \
    -d "{\"prefix\":\"$prefix\",\"limit\":1000,\"offset\":0,\"sortBy\":{\"column\":\"name\",\"order\":\"asc\"}}" \
    "$STORAGE_API/object/list/$BACKUP_BUCKET" |
    jq -r --arg cutoff "$cutoff" '.[].name | select((capture("(?<d>[0-9]{8})T") // {d: "99999999"}).d < $cutoff)')"
  [ -z "$names" ] && { echo "Nothing older than $days days under $prefix"; return 0; }
  jq -Rn --arg prefix "$prefix" '{prefixes: [inputs | select(length > 0) | "\($prefix)/\(.)"]}' <<<"$names" |
    _storage_curl -X DELETE -H "Content-Type: application/json" -d @- \
      "$STORAGE_API/object/$BACKUP_BUCKET" > /dev/null
  echo "Deleted $(wc -l <<<"$names") objects under $prefix"
}
