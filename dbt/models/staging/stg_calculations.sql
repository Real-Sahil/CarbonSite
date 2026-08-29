-- Staging model: calculation runs with context
-- Source: calculation_runs and calculation_run_snapshots tables
-- Links to factor library versions for full audit trail

SELECT
  cr.id as calculation_run_id,
  cr.organization_id,
  cr.reporting_period_id,
  cr.status as run_status,
  cr.started_at,
  cr.completed_at,
  EXTRACT(EPOCH FROM (cr.completed_at - cr.started_at))::int as duration_seconds,
  cr.factor_library_id,
  fl.name as factor_library_name,
  fl.version as factor_library_version,
  cr.methodology_version_id,
  mv.name as methodology_version_name,
  cr.created_by_user_id,
  cr.created_at as run_created_at,
  cr.updated_at as run_updated_at,
  pcs.id as published_snapshot_id,
  pcs.is_current_version,
  pcs.published_at
FROM calculation_runs cr
LEFT JOIN factor_libraries fl ON cr.factor_library_id = fl.id
LEFT JOIN methodology_versions mv ON cr.methodology_version_id = mv.id
LEFT JOIN published_calculation_snapshots pcs 
  ON cr.id = pcs.calculation_run_id
ORDER BY cr.organization_id, cr.completed_at DESC
