# Implementation Fixes Needed

The production feature implementations have been ported from the production-hardening branch, but there are compatibility issues with the current schema state that need to be resolved.

## Type Compatibility Issues

### 1. ROLE_GROUPS References
Files affected:
- app/api/orgs/[orgId]/bulk-operations/route.ts (line 33, 76)
- app/api/orgs/[orgId]/bulk-operations/[operationId]/route.ts (line 21, 75, 119)
- app/api/orgs/[orgId]/calculation-schedules/route.ts (line 37, 75)
- app/api/orgs/[orgId]/digests/route.ts (line 69)
- app/api/orgs/[orgId]/jobs/route.ts (line 26)

**Fix**: Replace incorrect ROLE_GROUPS references:
- `ROLE_GROUPS.editor` → `ROLE_GROUPS.sustainability`
- `ROLE_GROUPS.admin` → `ROLE_GROUPS.admins`
- `ROLE_GROUPS.reviewer` → `ROLE_GROUPS.reviewers`

### 2. Prisma Query Property Names
Files affected:
- lib/analytics/anomaly-detection.ts (multiple)
- lib/data-quality/scorer.ts (multiple)
- lib/export/excel.ts (multiple)
- app/api/orgs/[orgId]/export/excel/route.ts (multiple)

**Fix**: Update Prisma query selects and field references:
- `category` → `emissionCategory`
- `categoryId` → `emissionCategoryId`
- `quantity` → (remove, not a direct property of ActivityRecord)
- `evidence` → (use `ActivityRecordEvidence` relation if needed)

### 3. Missing Schema Fields
Files affected:
- lib/integrations/xero.ts

**Fix**: 
- `externalTenantId` and `metadata` need to be added to IntegrationConnection schema, OR
- These fields should be stored in the externalAccountId/externalAccountName or handled differently

### 4. Enum Value Corrections
Files affected:
- lib/notifications/digests.ts (line 271, 279)
- lib/data-quality/scorer.ts (line 187, 330)
- lib/integrations/xero.ts (line 279, 280)

**Fix**: Update review/calculation status enum values to match schema:
- `"pending_review"` → `"draft"` or `"in_review"` (check context)
- `"completed"` → `"succeeded"` (for CalculationRunStatus)
- `"not_provided"` → check EvidenceStatus options

### 5. Missing Module
Files affected:
- app/api/orgs/[orgId]/jobs/route.ts (line 8)

**Fix**: Create `lib/operations/failed-job-manager.ts` or remove the import and implement a different approach

### 6. NextRequest Property Access
Files affected:
- lib/middleware/rate-limit.ts (line 33, 98)

**Fix**: Use proper Next.js method to get client IP:
- `request.ip` → use `request.headers.get('x-forwarded-for')` or similar

### 7. Buffer Type Mismatch
Files affected:
- app/api/orgs/[orgId]/export/excel/route.ts (line 218)

**Fix**: Convert Buffer to proper format for fetch body

## Priority Fixes

1. **High Priority**: ROLE_GROUPS fixes (authentication will fail without these)
2. **High Priority**: Prisma query property names (queries will fail without these)
3. **Medium Priority**: Enum value fixes (business logic will fail without these)
4. **Medium Priority**: Missing module implementation
5. **Low Priority**: Buffer/IP address handling (infrastructure concerns)

## Testing Required

After fixes:
1. Run `pnpm typecheck` to verify all type errors are resolved
2. Run `pnpm test` to verify business logic
3. Test each endpoint manually to verify functionality
4. Run database migration to ensure schema is applied

## Notes

- The Prisma client has been regenerated with the new schema
- The migration file has been created (20260825000004_production_features)
- All new API routes are in place and need type/compatibility fixes
- All new utility functions are in place and need type/compatibility fixes
