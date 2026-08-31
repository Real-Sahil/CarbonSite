# Evidence File Storage Key Fix

## Problem

Field workers were seeing raw database URLs instead of presigned URLs when viewing submitted evidence files. This occurred because some `evidence_files` records in the database had corrupted `storageKey` values that contained actual URLs (e.g., `https://...`) instead of the proper format.

## Root Cause

Corrupted `storageKey` values likely resulted from:
1. Legacy code or data migration issues
2. Incomplete uploads where the key wasn't properly set before file creation
3. Direct database manipulation without validation

The correct format for `storageKey` is:
```
org/{organizationId}/evidence/{evidenceId}/{filename}
```

Examples of corrupted keys:
- `https://supabase.com/storage/v1/object/public/...`
- `http://localhost:3000/api/storage/serve?key=...`
- Raw Supabase/R2 URLs

## Solution

### API Changes

Both field submission endpoints now include additional validation:

1. **`GET /api/orgs/[orgId]/field-submissions`** — List submissions
2. **`GET /api/orgs/[orgId]/field-submissions/[submissionId]`** — Get individual submission

When processing evidence files:
- Check if `storageKey` starts with `http://` or `https://`
- If so, log the corruption and skip presign generation
- Return `downloadUrl: null` to mobile app (which displays "No image available")
- Never return raw URLs to clients

### Database Migration

Run the following to fix corrupted keys:

```bash
pnpm prisma migrate deploy
```

This applies the migration in `prisma/migrations/fix_corrupted_storage_keys/migration.sql`, which:
- Identifies all `evidence_files` rows with corrupted keys
- Reconstructs proper format using: `org/{organizationId}/evidence/{evidenceId}/{filename}`
- Updates all affected records atomically

### Manual Verification

To check for remaining corrupted keys:

```sql
SELECT COUNT(*) as corrupted_count
FROM evidence_files
WHERE storage_key LIKE 'http://%' OR storage_key LIKE 'https://%';
```

Should return `0` after migration.

## Testing

### Before Fix
1. Upload evidence file → observe corrupted `storageKey` in database
2. View submission on mobile → see raw URL instead of image
3. Logs show: `presignDownload failed for file ... Invalid storage key`

### After Fix
1. Run migration: `pnpm prisma migrate deploy`
2. View submission on mobile → see presigned URL image OR "No image available"
3. Logs show: `evidence file ... has corrupted storageKey (contains URL)`
4. New uploads create proper format: `org/{orgId}/evidence/{id}/{filename}`

## Implementation Details

### Storage Key Validation

`lib/storage/index.ts` contains `isValidStorageKey()`:
- Checks format matches: `org/{orgId}/evidence/{evidenceId}/{filename}` OR `user/{userId}/dsar/{requestId}/...`
- Rejects keys with leading `/`, backslashes, or double slashes
- Validates each segment matches alphanumeric + `.`, `_`, `-`, space
- Called by `assertStorageKey()` which throws on invalid format

### Presigned URL Generation

`presignDownload()` now safely handles:
1. Empty/null keys → logs warning, returns `null`
2. Corrupted keys (http/https URLs) → logs error, returns `null`  
3. Invalid format keys → `assertStorageKey()` throws, caught by API route
4. Valid keys → generates proper presigned URL

### Mobile App Behavior

`mobile/lib/features/submissions/submission_detail_screen.dart`:
- Checks if `downloadUrl` is empty before showing "View" button
- If empty, shows "No image available" instead of attempting to load URL
- Prefers local cached file over remote URL
- Safe error handling in `Image.network()` fallback

## Deployment

1. **Development**:
   ```bash
   pnpm prisma migrate dev  # Applies migration locally
   ```

2. **Production** (Neon):
   ```bash
   pnpm prisma migrate deploy  # Applied automatically on deploy
   ```

3. **Post-Deployment**:
   - Monitor logs for evidence file errors
   - Check that new uploads have proper `storageKey` format
   - Verify field workers can view images normally

## Monitoring

### Key Logs to Watch

```
[field-submissions] evidence file {id} has corrupted storageKey (contains URL)
[field-submissions] presignDownload failed for file {id} (key: "{key}")
[storage] Invalid storage key: {key}
```

### Metrics

- Count of corrupted keys before/after migration
- Count of presignDownload failures per day
- Mobile app image load success rate

## Related Files

- `lib/storage/index.ts` — Storage abstraction, key validation
- `app/api/orgs/[orgId]/field-submissions/route.ts` — List submissions
- `app/api/orgs/[orgId]/field-submissions/[submissionId]/route.ts` — Get submission
- `mobile/lib/features/submissions/submission_detail_screen.dart` — Mobile evidence viewer
- `prisma/migrations/fix_corrupted_storage_keys/migration.sql` — Migration to fix data
