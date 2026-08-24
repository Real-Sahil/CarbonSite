# Contributing to CarbonSite

Thank you for contributing to CarbonSite! This guide explains our development process, code review standards, and best practices.

## Before You Start

Read the project documentation:
- **Project Overview:** `CLAUDE.md` (in repository root)
- **Developer Guide:** `docs/developers.md`
- **API Examples:** `docs/api-examples.md`
- **Emission Calculations:** `docs/emissions-walkthrough.md`

## Development Setup

```bash
# 1. Clone repository
git clone https://github.com/Real-Sahil/CarbonSite
cd CarbonSite

# 2. Install dependencies
pnpm install

# 3. Set up environment
cp .env.example .env
# Edit .env with local Postgres connection

# 4. Create database and run migrations
pnpm prisma migrate dev

# 5. Start development servers (3 terminals)
# Terminal 1: Web server
pnpm dev

# Terminal 2: Worker (async jobs)
pnpm worker

# Terminal 3: Tests (watch mode)
pnpm test:watch
```

## Commit Guidelines

### Branch Naming
```
feature/add-dashboard-analytics          # New feature
fix/cross-tenant-security-bug            # Bug fix
refactor/simplify-calculation-engine     # Refactoring
docs/update-api-examples                 # Documentation
```

### Commit Message Format
```
<type>: <short summary (50 chars)>

<detailed description (72 chars per line)>

<footer with issue references>

Example:

fix: prevent field_worker access to org dashboard

Field workers should only be able to view their own submissions,
not the organization-wide dashboard. Added RBAC check to
GET /api/orgs/{orgId}/dashboard endpoint.

Fixes #456
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code refactoring (no behavior change)
- `docs:` Documentation updates
- `test:` Adding/updating tests
- `perf:` Performance improvements
- `chore:` Build, deps, tooling

### Commit Best Practices
- **Atomic commits:** One logical change per commit
- **Descriptive messages:** Include *why* not just *what*
- **Reference issues:** Include `Fixes #123` in footer
- **No secrets:** Never commit API keys, passwords, tokens

## Code Review Process

### Before Submitting a PR

1. **Run all checks locally:**
   ```bash
   pnpm lint          # ESLint fixes
   pnpm typecheck     # TypeScript compilation
   pnpm test          # All tests must pass
   pnpm build         # Production build must work
   ```

2. **Write tests:**
   - Unit tests for calculation logic
   - Integration tests for API workflows
   - Security tests for RBAC boundaries

3. **Update documentation:**
   - Database schema changes → update `prisma/schema.prisma` comment
   - API changes → update `docs/api-examples.md`
   - New features → update relevant `.md` files

4. **Create clear PR:**
   - Descriptive title (e.g., "Add report scheduling")
   - Link to related issues
   - Explain what changed and why
   - Note any database migrations needed

### Review Standards

#### Security (P0 - Must Pass)
- ✅ No hardcoded secrets
- ✅ Organization ID enforced on all tenant queries
- ✅ RBAC checks on all org-scoped endpoints
- ✅ Input validation with Zod
- ✅ No SQL injection vulnerabilities
- ✅ HTTPS/CORS properly configured
- ✅ No cross-tenant access

**If any P0 issue found:** Request changes immediately.

#### Correctness (P1 - Must Pass)
- ✅ Tests pass locally and in CI
- ✅ TypeScript types are sound (no `any`, no `// @ts-ignore`)
- ✅ No console errors/warnings
- ✅ Database migrations are safe
- ✅ Calculations match expected formulas
- ✅ Immutability preserved (no updates to EmissionCalculation rows)

**If P1 issue found:** Request changes.

#### Code Quality (P2 - Preferred)
- ✅ Follows project style (via ESLint)
- ✅ No unnecessary duplication
- ✅ Clear variable/function names
- ✅ Minimal comments (only *why*, not *what*)
- ✅ Sensible error messages for users
- ✅ Proper error logging for debugging

**If P2 issue found:** Suggest improvements (author can decline for speed).

#### Performance (P3 - Consider)
- ✅ No N+1 database queries
- ✅ Reasonable algorithm complexity
- ✅ Large files streamed (not loaded into memory)
- ✅ Batch operations where applicable
- ✅ Indexes added for frequently queried columns

**If P3 issue found:** Note for future optimization (non-blocking).

### Review Checklist (For Reviewers)

- [ ] **Security:** No tenant leaks, secrets, injection points
- [ ] **Tests:** Unit + integration coverage; fixtures deterministic
- [ ] **Types:** TypeScript strict mode; no type assertions
- [ ] **Migrations:** Safe for rolling deployments; reversible
- [ ] **API:** Consistent error format; proper status codes
- [ ] **Docs:** Updated if needed; examples accurate
- [ ] **Performance:** No obvious slowdowns; indices added
- [ ] **Code:** Style consistent; naming clear; comments justified

## Multi-Tenancy & Security

**Every org-scoped operation must include organization_id.** This is non-negotiable.

### Security Review Checklist
```typescript
// ✅ CORRECT: Org-scoped query
const records = await db.activityRecord.findMany({
  where: {
    organization_id: orgId,
    category: 'S1_STATIONARY',
  },
});

// ❌ WRONG: Missing organization_id (SECURITY BUG)
const records = await db.activityRecord.findMany({
  where: { category: 'S1_STATIONARY' },
});
```

### RBAC Review Checklist
```typescript
// ✅ CORRECT: Enforce role check
const session = await requireOrgMember(orgId, ['admin', 'editor']);

// ❌ WRONG: No RBAC check
export async function POST(req: Request, { params }: { params: { orgId: string } }) {
  // User identity not verified!
}
```

## Testing Requirements

### Unit Tests
Test calculation logic, units, factor selection in isolation:

```typescript
// lib/calculation/your-calc.test.ts
describe('calculateYourMetric', () => {
  it('computes CO2e correctly', async () => {
    const result = await calculateYourMetric('org-1', {
      category: 's1-stationary',
      value: 100,
      unit: 'kWh',
    });
    expect(result.co2e).toBe(45.2);
  });
});
```

### Integration Tests
Test full workflows (import → calculate → publish):

```typescript
test('end-to-end: import and calculate', async () => {
  const batch = await createImport(orgId, csvFile);
  await waitFor(() => batch.status === 'ready_to_commit');
  await commitImport(orgId, batch.id);
  const run = await runCalculation(orgId, { periodId });
  expect(run.status).toBe('completed');
});
```

### Security Tests
Always test RBAC boundaries:

```typescript
test('field_worker cannot access dashboard', async () => {
  const response = await fetch(`/api/orgs/${orgId}/dashboard`, {
    headers: { 'Authorization': `Bearer ${fieldWorkerToken}` },
  });
  expect(response.status).toBe(403);
});
```

### Test Coverage Goals
- **Calculation engine:** 100% coverage (immutability critical)
- **API routes:** 80%+ coverage (especially RBAC)
- **RBAC:** 100% role combinations tested
- **Database:** Test migrations are reversible

## Database Migrations

### Creating a Migration
```bash
# Make schema changes in prisma/schema.prisma
pnpm prisma migrate dev --name add_your_table
# Migration file created: prisma/migrations/20250824xxxxxx_add_your_table/
```

### Migration Standards
- ✅ Migrations are reversible (no destructive drops)
- ✅ New columns have defaults (don't break existing code)
- ✅ Foreign keys maintain referential integrity
- ✅ Indexes added for frequently queried columns
- ✅ Large table alterations are batched

### Testing Migrations
```bash
# Test forward
pnpm prisma migrate dev

# Test reverse
pnpm prisma migrate resolve --rolled-back <migration-name>
pnpm prisma migrate deploy
```

## API Design Standards

### Endpoints
```typescript
// ✅ Consistent pattern
POST   /api/orgs/{orgId}/activity-records        # Create
GET    /api/orgs/{orgId}/activity-records        # List (paginated)
GET    /api/orgs/{orgId}/activity-records/{id}   # Get
PATCH  /api/orgs/{orgId}/activity-records/{id}   # Update
DELETE /api/orgs/{orgId}/activity-records/{id}   # Delete
```

### Error Format
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid input",
  "details": {
    "errors": [
      { "field": "email", "message": "Invalid format" }
    ]
  }
}
```

### Pagination
Use cursor-based pagination:
```typescript
interface ListResponse<T> {
  data: T[];
  pagination: {
    cursor: string;        // Pass to next request
    hasMore: boolean;
  };
}
```

## Performance Considerations

### Query Performance
- Add indexes for frequently queried columns
- Use `SELECT col1, col2` instead of `SELECT *`
- Batch operations (avoid N+1 queries)
- Test with realistic data volume (1k+ records)

### Import Performance
- Imports up to 25k rows must process asynchronously
- Parse, validate, commit as separate phases
- Stream large files; never load entire file into memory

### Dashboard Performance
- Dashboard queries must complete in < 3 seconds
- Use pre-computed `DashboardAggregate` rows
- Never aggregate raw `EmissionCalculation` at request time

## Documentation Standards

### Code Comments
Only comment the *why*, not the *what*:

```typescript
// ❌ Obvious comment (don't do this)
// Convert m³ to kWh
const kWh = m3 * 0.0108;

// ✅ Explains non-obvious logic
// Convert m³ to kWh using DEFRA calorific value
// (accounts for gas pressure/temperature variation in UK)
const kWh = m3 * 0.0108;
```

### Docstrings
No multi-line docstrings. Write clear function names instead:

```typescript
// ❌ Over-commented
/**
 * Calculates CO2e emissions for an activity record
 * by normalizing units, selecting factors, and applying formulas
 * @param orgId the organization ID
 * @param record the activity record
 */
async function calculate(orgId: string, record: ActivityRecord) {
  // ...
}

// ✅ Clear, minimal
async function calculateEmissionsForRecord(orgId: string, record: ActivityRecord) {
  // ...
}
```

### README & Guides
- Keep updated as project evolves
- Link examples to real code locations
- Include both cURL and JavaScript examples
- Update when adding new features

## Deployment & Releases

### Pre-Deployment Checklist
- [ ] Main branch is green (all tests pass)
- [ ] No uncommitted changes
- [ ] Migrations are reversible
- [ ] Security audit complete
- [ ] Performance tested
- [ ] Documentation updated

### Rollback Procedure
```bash
# If deployment has critical issues
vercel rollback  # Revert to previous deployment
# OR
git revert <commit-hash>
git push origin main
```

## Questions or Issues?

- **Development:** See `docs/developers.md`
- **Operations:** See `docs/operators.md`
- **API Help:** See `docs/api-examples.md`
- **Calculations:** See `docs/emissions-walkthrough.md`
- **Project Details:** See `CLAUDE.md`

---

**Thank you for contributing to CarbonSite!** Your work helps make carbon accounting accessible to small and mid-market companies.
