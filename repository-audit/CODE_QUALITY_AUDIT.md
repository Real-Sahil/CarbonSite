# Code Quality Audit — CarbonSite

---

## Summary Score: 67 / 100

Existing code is clean, consistent, and follows the patterns established in CLAUDE.md. The main quality issues are: incomplete implementations presented as production routes (worker stubs), dead dependencies, partially-implemented OCR extractor, missing stub pages behind real navigation links, and a few structural concerns in the Flutter app.

---

## Dead Code

### Unused npm Dependencies

| Package | `package.json` | Used in codebase | Action |
|---|---|---|---|
| `motion` | ^12.40.0 | Not imported anywhere | **Remove** |
| `@hookform/resolvers` | ^5.4.0 | Not imported anywhere | **Remove** |
| `react-hook-form` | ^7.77.0 | Not imported anywhere | **Remove** |
| `firebase-admin` | ^13.10.0 | Referenced in CLAUDE.md but not imported in any source file | Keep — needed for Milestone 4 notifications worker |
| `mammoth` | ^1.12.0 | Not imported anywhere | Keep — needed for Milestone 2 import worker |
| `pdf-parse` | ^2.4.5 | Not imported anywhere | Keep — needed for Milestone 2 |

**Action for `motion`, `@hookform/resolvers`, `react-hook-form`:**
```bash
pnpm remove motion @hookform/resolvers react-hook-form
```
Bundle impact: removes ~180 KB from production bundle.

---

### Unused Flutter Dependencies

| Package | `pubspec.yaml` | Used in Dart code | Action |
|---|---|---|---|
| `drift` | ^2.20.3 | Not imported | Keep — Milestone 2 offline |
| `sqlite3_flutter_libs` | ^0.5.24 | Not imported | Keep — Milestone 2 |
| `connectivity_plus` | ^6.1.2 | Not imported | Keep — Milestone 2 sync |
| `image_cropper` | ^8.0.1 | Not imported | Keep — Milestone 2 capture |
| `mobile_scanner` | ^5.2.3 | Not imported | Keep — Milestone 2 QR |
| `geolocator` | ^13.0.2 | Not imported | Keep — Milestone 2 GPS |
| `fl_chart` | ^0.70.2 | Not imported | Keep — Milestone 4 dashboard |
| `share_plus` | ^10.1.3 | Not imported | Keep — Milestone 5 reports |
| `freezed_annotation` | ^2.4.4 | Not imported, no `.freezed.dart` files | Keep — code gen for Milestone 2 |
| `json_annotation` | ^4.9.0 | Not imported, no `.g.dart` files | Keep — code gen for Milestone 2 |

These are all Milestone 2+ dependencies correctly pre-declared. Acceptable state.

---

### Unimplemented Feature Pages (Navigation Links to 404s)

**File:** `components/org-sidebar.tsx`

The sidebar has 7 navigation items. 5 of them link to pages that don't exist:

| Route | Page file | Status |
|---|---|---|
| `/orgs/${orgId}/dashboard` | `app/(app)/orgs/[orgId]/dashboard/page.tsx` | Exists (placeholder UI) |
| `/orgs/${orgId}/submissions` | `app/(app)/orgs/[orgId]/submissions/page.tsx` | Exists (functional) |
| `/orgs/${orgId}/records` | Does not exist | **404** |
| `/orgs/${orgId}/imports` | Does not exist | **404** |
| `/orgs/${orgId}/reports` | Does not exist | **404** |
| `/orgs/${orgId}/targets` | Does not exist | **404** |
| `/orgs/${orgId}/settings/members` | `app/(app)/orgs/[orgId]/settings/members/page.tsx` | Exists (functional) |

**Action:** Add stub pages for the missing routes to prevent broken links. Minimum viable stub:

```tsx
// app/(app)/orgs/[orgId]/records/page.tsx
export default function RecordsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900">Activity Records</h1>
      <p className="text-slate-500 mt-1">Coming in Milestone 2.</p>
    </div>
  );
}
```

---

## Worker Stubs (Critical Missing Implementation)

**File:** `workers/index.ts`

All four workers log the job and exit without doing any work:

```typescript
async (jobs: Job<ImportJobData>[]) => {
  for (const job of jobs) {
    console.log("[imports] processing:", job.data);
    // TODO: parse file from R2 → validate rows → create StagedActivityRecord rows
  }
}
```

These are the core business logic paths. Until implemented:
- CSV imports never parse
- Calculations never run
- Reports never generate
- Notifications never send

Enqueued jobs will be picked up, "completed" (no error thrown), and removed from the queue — silently discarding work.

---

## Partially Implemented OCR Extractor

**File:** `mobile/lib/features/capture/ocr_extractor.dart`

`ExtractedFields` declares 13 fields. The `extract()` method only populates 6:

| Field | Populated? |
|---|---|
| `weight` | Yes |
| `weightUnit` | Yes |
| `ewcCode` | Yes |
| `date` | Yes |
| `vehicleReg` | Yes |
| `volume` | Yes |
| `volumeUnit` | Yes |
| `supplierName` | **No** — always null |
| `materialType` | **No** — always null |
| `quantity` | **No** — always null |
| `quantityUnit` | **No** — always null |
| `fuelType` | **No** — always null |
| `documentType` | Yes (passed in) |

The `fuelType` field is particularly important for fuel receipts — the primary Scope 1 document type.

---

## Code Duplication

### `FlutterSecureStorage` Instantiated Twice

**Files:**  
- `mobile/lib/core/api/client.dart:7` — `const _storage = FlutterSecureStorage();`
- `mobile/lib/core/api/endpoints.dart:5` — `const _storage = FlutterSecureStorage();`

Each file creates its own instance. While `FlutterSecureStorage` is stateless (it delegates to platform keychain/keystore), multiple instances are unnecessary.

**Fix:** Extract a shared singleton:
```dart
// lib/core/storage/secure_storage.dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const secureStorage = FlutterSecureStorage(
  aOptions: AndroidOptions(encryptedSharedPreferences: true),
  iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
);
```

---

### `requireOrgMember` Pattern Repeated Across All API Routes

Every API route opens with the same 3–4 lines. This is intentional consistency, not duplication — the pattern is correct and readable. No refactoring recommended.

---

## Complex Methods

### `computeCo2e` — Acceptable Complexity

**File:** `lib/calculation/engine.ts:26`

The function handles two branches (gas-specific vs. scalar) with adequate test coverage. Length is appropriate for the domain.

### `_PinSetupScreenState.build` — High Widget Complexity

**File:** `mobile/lib/features/auth/pin_setup_screen.dart`

The `build()` method is ~100 lines with nested `Column`, `Row`, and conditional rendering. Should be decomposed into:
- `_PinDots` widget (extracted as private widget — good)
- `_StepTitle` widget (inline text — extract)
- `_NumPad` widget (extracted — good)

The current structure is borderline acceptable for an auth screen.

---

## Naming Issues

### `writeAuditLog` in `org/route.ts` Uses Wrong Action

**File:** `app/api/orgs/route.ts:33`

```typescript
await writeAuditLog({
  action: "record.created",    // ← wrong category
  resourceType: "organization",
  ...
});
```

The action `"record.created"` implies an `ActivityRecord` creation. Organization creation should use a more specific action. The `AuditAction` type in `lib/db/audit.ts` does not include an `"org.created"` variant.

**Fix:** Add `"org.created"` to the `AuditAction` union type and use it here.

---

### Inconsistent `orgId` / `organizationId` Naming

The Prisma schema uses `organizationId` everywhere. API route parameters use `orgId`. Flutter model classes handle both: `json['organizationId'] as String? ?? json['organization_id'] as String?`. This dual-mapping adds cognitive load and is a source of subtle bugs.

**Recommendation:** Standardize on `organizationId` in API responses. Update all client-side models to use the canonical name.

---

## File Size / Large Files

| File | Lines | Concern |
|---|---|---|
| `prisma/schema.prisma` | ~330 | Large but appropriate for full data model |
| `lib/calculation/units.ts` | ~70 | Appropriate |
| `lib/validation/org.ts` | ~80 | Appropriate |
| `mobile/lib/features/auth/pin_setup_screen.dart` | ~280 | Borderline — could extract `_NumPad` to its own file |
| `mobile/lib/features/submissions/home_screen.dart` | ~230 | Acceptable |

No files are critically large. No concern at current state.

---

## Architecture Violations

### Worker Uses `console.log` for Job Processing Confirmation

**File:** `workers/index.ts`

Per CLAUDE.md: "Structured logs with `request_id`, `org_id`, `user_id`, `route`, `status`, `duration_ms`, `error_code`". The worker uses `console.log` with unstructured strings.

---

### `lib/jobs/boss.ts` Singleton Not Used in Worker Process

**File:** `workers/index.ts:8`

```typescript
// In workers/index.ts:
const boss = new PgBoss({ connectionString: process.env.DATABASE_URL!, max: 10 });
```

The worker process creates its own `PgBoss` instance instead of using the `lib/jobs/boss.ts` singleton. This is actually correct behavior (worker is a separate process), but the singleton in `lib/jobs/boss.ts` uses `globalThis` caching which is unnecessary for the worker context.

---

## Refactoring Roadmap

### Priority 1 (This Sprint)
1. Add stub pages for missing navigation routes (records, imports, reports, targets)
2. Remove unused npm deps: `motion`, `@hookform/resolvers`, `react-hook-form`
3. Fix `writeAuditLog` action name for org creation
4. Extract `FlutterSecureStorage` singleton in Flutter

### Priority 2 (Milestone 2)
1. Implement all four worker handlers
2. Complete OCR extractor field extraction (supplierName, materialType, fuelType)
3. Migrate home screen data fetching to Riverpod AsyncNotifier
4. Create drift database schema

### Priority 3 (Milestone 3)
1. Decompose large server components into smaller composable parts
2. Add structured logging to worker process
3. Add LRU cache for auth session lookups
