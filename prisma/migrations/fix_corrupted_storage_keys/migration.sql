-- Fix corrupted storageKey values that contain http:// or https:// URLs
-- These should follow the format: org/{orgId}/evidence/{evidenceId}/{filename}

UPDATE evidence_files
SET storage_key = concat('org/', organization_id, '/evidence/', id, '/', filename)
WHERE
  (storage_key LIKE 'http://%' OR storage_key LIKE 'https://%')
  AND organization_id IS NOT NULL
  AND filename IS NOT NULL
  AND id IS NOT NULL;
