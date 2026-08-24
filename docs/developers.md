# Developer Guide: Feature Development Workflow

This guide is for developers adding new features, fixing bugs, or refactoring CarbonSite.

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/Real-Sahil/CarbonSite
cd CarbonSite
pnpm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your local Postgres connection string

# 3. Start development
pnpm dev                # Next.js dev server (localhost:3000)
pnpm worker            # pg-boss worker (separate terminal)
pnpm test:watch        # Vitest watch mode (separate terminal)

# 4. Before committing
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Architecture Overview

### Folder Structure Reference
```
app/
  api/
    orgs/[orgId]/      # All org-scoped REST endpoints
      imports/
      activity-records/
      calculation-runs/
      reports/
      dashboard/
      field-submissions/
  (auth)/              # Sign in, sign up, reset password
  (app)/               # Authenticated web app shell
    orgs/[orgId]/
      dashboard/
      imports/
      records/
      submissions/     # Review queue for field submissions
      calculations/
      reports/

lib/
  auth/
    index.ts           # Better Auth config
    session.ts         # requireSession(), requireOrgMember()
  db/
    index.ts           # Prisma client singleton
    audit.ts           # writeAuditLog()
  jobs/
    queues/index.ts    # pg-boss queue definitions
  storage/index.ts     # Cloudflare R2 client
  validation/
    api.ts             # handleRouteError(), apiError()
  calculation/
    units.ts           # Unit registry + normalizeUnit()
    factor-selector.ts # selectFactor()
    engine.ts          # computeCo2e()

prisma/
  schema.prisma        # Canonical schema (all tables include organization_id)
  migrations/
  seed.ts              # Seeds categories, methodology, DEFRA/EPA/SustainMetrics factors

workers/
  index.ts             # pg-boss worker entry point
```

### Multi-Tenancy Pattern

**Every org-scoped query must include organization_id.** This is enforced at the API layer:

```typescript
// ✅ CORRECT: Scoped to org
const records = await db.activityRecord.findMany({
  where: {
    organization_id: orgId,
    reporting_period_id: periodId,
  },
});

// ❌ WRONG: Missing org scope (security bug)
const records = await db.activityRecord.findMany({
  where: { reporting_period_id: periodId },
});
```

Use the `requireOrgMember()` helper to enforce this at route level:

```typescript
export async function GET(req: Request, { params }: { params: { orgId: string } }) {
  const session = await requireOrgMember(params.orgId, ['admin', 'editor']);
  // At this point, session.user.organizationId === params.orgId
  // and user has admin OR editor role
}
```

### RBAC: Six Role Levels

| Role | Permissions | Use Case |
|---|---|---|
| `admin` | All actions, user management, billing | Org owner, finance lead |
| `editor` | Import, create records, run calculations | Sustainability manager |
| `reviewer` | Approve/reject field submissions, publish snapshots | QA, compliance |
| `viewer` | Read-only access to all reports and dashboards | Executives, auditors |
| `auditor` | Full read access to audit logs, immutable calculations | External auditor |
| `field_worker` | Submit field evidence only, view own submissions | Subcontractors, suppliers |

**Cross-tenant access is a P0 security bug.** Always test RBAC boundaries when adding features.

## Feature Development Workflow

### 1. Planning Phase

Before coding, determine:
- **What data model is needed?** (Prisma schema changes)
- **What endpoints need to exist?** (API routes)
- **What calculations are involved?** (see Calculation Engine below)
- **Who should have access?** (RBAC roles)
- **Is this async work?** (needs pg-boss queue?)

Write this down in a comment or PR description.

### 2. Database Schema

Edit `prisma/schema.prisma`:

```typescript
model YourNewTable {
  id                  String    @id @default(cuid())
  organization_id     String    // ← MANDATORY for all tenant tables
  name                String
  created_at          DateTime  @default(now())
  updated_at          DateTime  @updatedAt
  
  organization        Organization @relation(fields: [organization_id], references: [id])

  @@index([organization_id])
}
```

**Always:**
- Include `organization_id` on every tenant-owned table
- Add indexes on frequently queried columns
- Use `@default(cuid())` for auto-ID generation
- Add timestamps (`created_at`, `updated_at`)

Create a migration:

```bash
pnpm prisma migrate dev --name add_your_table
# Migrations go to prisma/migrations/
```

### 3. API Routes (Endpoints)

Create routes in `app/api/orgs/[orgId]/your-resource/`:

```typescript
// app/api/orgs/[orgId]/your-resource/route.ts

import { requireOrgMember } from '@/lib/auth/session';
import { handleRouteError, apiError } from '@/lib/validation/api';
import { z } from 'zod';
import { db } from '@/lib/db';

const CreateResourceSchema = z.object({
  name: z.string().min(1, 'Name required'),
});

export async function POST(req: Request, { params }: { params: { orgId: string } }) {
  try {
    const session = await requireOrgMember(params.orgId, ['admin', 'editor']);
    const body = await req.json();
    const validated = CreateResourceSchema.parse(body);

    const resource = await db.yourNewTable.create({
      data: {
        organization_id: params.orgId,
        name: validated.name,
      },
    });

    return Response.json(resource, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(req: Request, { params }: { params: { orgId: string } }) {
  try {
    const session = await requireOrgMember(params.orgId, ['viewer', 'editor', 'admin']);
    
    const resources = await db.yourNewTable.findMany({
      where: { organization_id: params.orgId },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    return Response.json({ data: resources });
  } catch (err) {
    return handleRouteError(err);
  }
}
```

**Always:**
- Validate input with Zod before querying DB
- Use `requireOrgMember()` to enforce auth and org scope
- Use `handleRouteError()` to return consistent error format: `{ code, message, details? }`
- Implement pagination on list endpoints (cursor-based preferred)
- Log significant actions via `writeAuditLog()`

### 4. Calculation Logic

If your feature involves emissions calculations, add logic to `lib/calculation/`:

```typescript
// lib/calculation/your-calc.ts

import { normalizeUnit } from './units';
import { selectFactor } from './factor-selector';
import { computeCo2e } from './engine';

export async function calculateYourMetric(
  orgId: string,
  activityData: ActivityRecord,
) {
  // Step 1: Normalize units (store both original and normalized)
  const normalized = normalizeUnit(activityData.value, activityData.unit);

  // Step 2: Select appropriate emission factor
  const factor = await selectFactor({
    category: activityData.category,
    date: activityData.date,
    geography: activityData.facility?.geography,
    scope2Method: 'location-based', // or 'market-based'
  });

  // Step 3: Compute CO2e (stores formula string for audit)
  const result = computeCo2e({
    originalValue: activityData.value,
    normalizedValue: normalized.value,
    normalizedUnit: normalized.unit,
    factor: factor,
  });

  return result; // { co2e, formula, factorSourceId, factorVersionId }
}
```

**Calculation Invariants:**
- All calculations are **immutable** — never update `EmissionCalculation` rows
- Always store the **formula string** for audits
- Always record which **factor version** was used
- Tests must use **deterministic fixture factors**, not real data

### 5. Background Jobs (Async Work)

If your feature needs async processing (imports, calculations, reports), use pg-boss:

```typescript
// lib/jobs/queues/index.ts
import { Queue } from 'pg-boss';

export const importQueue = pgboss.createQueue('imports');
export const calculationQueue = pgboss.createQueue('calculations');
export const customQueue = pgboss.createQueue('your-queue-name');
```

Enqueue from API:

```typescript
export async function POST(req: Request, { params }: { params: { orgId: string } }) {
  // ... validation ...
  
  const jobId = await customQueue.send(
    { organization_id: orgId, data: validated },
    { retryLimit: 3 }
  );
  
  return Response.json({ jobId });
}
```

Process in worker:

```typescript
// workers/your-job-handler.ts
import { customQueue } from '@/lib/jobs/queues';

export async function handleYourJob() {
  await customQueue.subscribe({ newJobOnly: false }, async (job) => {
    try {
      const { organization_id, data } = job.data;
      
      // Do work here
      await processYourJob(organization_id, data);
      
      await job.done();
    } catch (err) {
      console.error(`Job ${job.id} failed:`, err);
      throw err; // pg-boss will retry
    }
  });
}
```

**Job Guidelines:**
- All jobs must be **idempotent** (safe to run multiple times)
- Always store job **status in DB** (`status`, `error`, `result`)
- Set **retry limits** (typically 3)
- Log job **start**, **completion**, and **failure**

### 6. Testing

#### Unit Tests
Test calculation logic, unit conversions, factor selection in isolation:

```typescript
// lib/calculation/your-calc.test.ts
import { describe, it, expect } from 'vitest';
import { calculateYourMetric } from './your-calc';

describe('calculateYourMetric', () => {
  it('computes CO2e correctly for standard activity', async () => {
    const result = await calculateYourMetric('org-1', {
      category: 's1-stationary',
      value: 100,
      unit: 'kWh',
      date: new Date('2025-01-15'),
    });

    expect(result.co2e).toBe(45.2); // DEFRA 2025 factor for electricity
    expect(result.formula).toContain('100 * 0.452');
  });
});
```

#### Integration Tests
Test full workflows (import → calculate → publish):

```typescript
// Test: Import CSV → stage records → commit → calculate → publish
test('end-to-end: import workflow', async () => {
  // 1. Create import batch
  const batch = await createImport(orgId, csvFile);
  
  // 2. Wait for parsing/validation
  await waitFor(() => batch.status === 'ready_to_commit');
  
  // 3. Commit records
  await commitImport(orgId, batch.id);
  
  // 4. Run calculation
  const run = await runCalculation(orgId, { periodId });
  
  // 5. Publish snapshot
  const snapshot = await publishSnapshot(orgId, run.id);
  
  // 6. Verify dashboard totals match calculation totals
  expect(snapshot.totals.co2e).toBe(run.totals.co2e);
});
```

#### Security Tests
Always test RBAC boundaries:

```typescript
test('field_worker cannot access dashboard aggregates', async () => {
  const fieldWorkerSession = await auth.signIn(fieldWorkerEmail);
  
  const response = await fetch(`/api/orgs/${orgId}/dashboard`, {
    headers: { 'Cookie': fieldWorkerSession.cookie },
  });
  
  expect(response.status).toBe(403);
});
```

Run all tests before pushing:

```bash
pnpm test              # Run all tests once
pnpm test:watch        # Watch mode during development
pnpm lint && pnpm typecheck  # Check code quality
```

## Common Patterns

### Error Handling

Use consistent error responses:

```typescript
import { handleRouteError, apiError } from '@/lib/validation/api';

export async function POST(req: Request) {
  try {
    // ... your code ...
  } catch (err) {
    if (err instanceof ZodError) {
      return apiError('VALIDATION_ERROR', 'Invalid input', { errors: err.errors });
    }
    if (err instanceof PrismaClientKnownRequestError) {
      return apiError('DATABASE_ERROR', 'Database operation failed');
    }
    return handleRouteError(err); // Catches all errors
  }
}
```

### Audit Logging

Log all significant events:

```typescript
import { writeAuditLog } from '@/lib/db/audit';

await writeAuditLog({
  organizationId: orgId,
  userId: session.user.id,
  action: 'IMPORT_COMMITTED',
  resourceType: 'ImportBatch',
  resourceId: batchId,
  details: { recordCount: 150, periodId },
  timestamp: new Date(),
});
```

### Storage (R2)

Upload/download files with auth checks:

```typescript
import { storage } from '@/lib/storage';

// Generate presigned upload URL
const uploadUrl = await storage.presignUpload({
  key: `org/${orgId}/evidence/${evidenceId}/photo.jpg`,
  expiryMinutes: 15,
});

// Generate presigned download URL
const downloadUrl = await storage.presignDownload({
  key: `org/${orgId}/reports/${reportId}/report.pdf`,
  expiryMinutes: 15,
});
```

## Before Submitting a PR

```bash
# 1. Run all checks locally
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# 2. Create meaningful commit messages
git commit -m "Add feature: X

- Implement API endpoint for X
- Add calculation logic for Y
- Update schema with new table
- Add 15 unit tests

Fixes #123"

# 3. Push to your branch
git push -u origin feature/your-feature

# 4. Open PR with:
   - Clear description of what changed and why
   - Link to related issues
   - List of test coverage
   - Any security considerations
   - Migration notes (if DB changes)
```

## Troubleshooting

### Prisma migrations fail
```bash
# Reset local DB (dev only!)
pnpm prisma migrate reset
```

### Calculation results don't match dashboard
- Check `DashboardAggregate` rows are being rebuilt after calculation run
- Verify `EmissionCalculation` rows haven't been updated (immutability)
- Confirm factor version is consistent

### Tests fail intermittently
- Check database cleanup between tests
- Verify no race conditions in async code
- Use `beforeEach()` to reset state

### Job queue backing up
- Check worker process is running (`pnpm worker`)
- Review job logs for errors
- Consider increasing retry limits or batch size

## Resources

- **Tech Stack Details:** See `CLAUDE.md` in repository root
- **Database Schema:** `prisma/schema.prisma`
- **API Reference:** `docs/api-examples.md`
- **Emission Calculation Walkthrough:** `docs/emissions-walkthrough.md`
- **Operations Guide:** `docs/operators.md`
