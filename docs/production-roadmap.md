# MetricOra Production Roadmap

## Summary

MetricOra is a multi-tenant GHG emissions platform for small-to-mid-market organisations, with construction and field-capture workflows as the first vertical wedge. The production architecture is Next.js on Vercel, Better Auth, Postgres via Prisma, Cloudflare R2-compatible object storage, inline job processing with optional pg-boss workers, and a Flutter mobile app for field submissions.

The production bar is simple: no static business data, no fake metrics, no placeholder workflows, and no UI that looks generated. Every visible operational state must come from authenticated sessions, organisation-scoped database records, storage objects, job state, calculation runs, published snapshots, reports, or audit logs.

## Production Principles

- Treat `origin/main` as the canonical branch and keep the Vercel/Next/Prisma architecture intact.
- Enforce organisation scoping on every tenant-owned query and API route.
- Keep job processing explicit. Vercel-only deployments process imports, calculations, and reports inline; larger deployments can switch `JOB_PROCESSING_MODE=worker` and run `pnpm worker`.
- Store evidence, import files, error exports, and reports through the storage abstraction with signed URLs only.
- Make calculations traceable, deterministic, immutable, and tied to methodology and factor library versions.
- Use dashboard aggregates and published snapshots for reporting surfaces; do not calculate dashboard totals from raw rows at request time.
- Make audit logs append-only and comprehensive for every material user, data, factor, calculation, report, review, and role event.
- Design the UI as a serious operations product: dense, calm, accessible, data-first, and free of decorative filler.

## Roadmap

### Phase 1: Canonical Production Baseline

- Confirm the branch uses standard Next/Vercel commands: `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
- Remove stale planning references to vinext, Sites, D1, Supabase-primary storage/auth, and Cloudflare Worker app runtime.
- Keep `.env.example` complete for database, Better Auth, storage, email, push notifications, workers, and app URLs.
- Ensure CI runs lint, typecheck, calculation tests, build, Flutter analyze, and Flutter tests.
- Add docs for local Postgres setup, Vercel deployment, worker deployment, R2 bucket setup, and production smoke testing.

### Phase 2: Multi-Tenant Core

- Finish authenticated organisation creation, organisation selection, member management, roles, invite links, facilities, business units, and reporting periods.
- Route all org-scoped pages through session and membership checks.
- Enforce RBAC server-side for `admin`, `editor`, `reviewer`, `viewer`, `auditor`, and `field_worker`.
- Add audit logs for organisation changes, membership changes, invite link creation/use, and auth-sensitive events.
- Add cross-tenant regression tests for every org-scoped API family.

### Phase 3: Real Data Intake

- Build the import centre around `ImportBatch` and `StagedActivityRecord`.
- Support CSV/XLSX upload, checksum capture, idempotency keys, column mapping, validation, row errors, warnings, and staged commit.
- Store source files and generated error CSVs in storage using org-scoped keys.
- Add manual activity record creation for MVP categories.
- Require all records to be tied to an organisation, reporting period, emission category, creator, review status, and evidence status.
- Replace empty placeholders with real empty states that explain the next action and link to the relevant workflow.

### Phase 4: Field Capture Wedge

- Use field-worker invite links for mobile onboarding.
- Implement Flutter field capture for waste tickets, delivery notes, fuel receipts, and other evidence.
- Store mobile submissions offline first, then sync idempotently when online.
- Run on-device OCR and submit extracted fields plus reviewed form data to the backend.
- Surface `FieldSubmission` records in the web review queue.
- Allow reviewers to approve, reject, or request more information.
- Convert approved submissions into committed `ActivityRecord` rows with linked `EvidenceFile` records.

### Phase 5: Calculation Engine

- Seed methodology versions, emission categories, factor libraries, and approved factor rows.
- Normalize units before factor selection and store both original and normalized values.
- Select factors deterministically and persist the selection reason.
- Persist immutable `EmissionCalculation` rows for every record in a calculation run.
- Rebuild `DashboardAggregate` rows after successful runs.
- Prevent mutation of published snapshots; recalculation creates a new run and snapshot version.
- Cover unit normalization, factor selection, scalar CO2e, gas-specific CO2e, warnings, and failure cases with tests.

### Phase 6: Dashboards, Reporting, And Audit

- Build dashboards from `DashboardAggregate` only.
- Show totals by scope, category, facility, business unit, period, and review/evidence completeness.
- Generate PDF and CSV reports asynchronously from published snapshots.
- Store report artefacts in storage with checksums and signed download URLs.
- Ensure report totals match dashboard totals for the same snapshot.
- Include methodology, factor library version, assumptions, data quality, evidence status, and calculation appendices in reports.
- Add audit events for calculation runs, snapshot publication, report generation, downloads, evidence review, and activity record changes.

### Phase 7: Production Hardening

- Deploy the web app from GitHub to Vercel.
- Keep Vercel on inline job processing until a separate worker is deployed and monitored; then switch `JOB_PROCESSING_MODE=worker`.
- Configure managed Postgres, object storage, email, and push notification credentials.
- Add job retry handling, failed-job visibility, import/report failure surfaces, and operational runbooks.
- Add file size limits, MIME allowlists, route rate limits, signed URL expiry, and storage key validation.
- Add database backup/restore procedures and incident runbooks.
- Add accessibility checks for forms, tables, charts, dialogs, focus states, and mobile capture flows.

## UX Standard

- Use shadcn/Radix components as a foundation, but customise spacing, density, copy, iconography, and states so the product does not look like a template.
- Keep the web app calm and operational: clear tables, filters, drawers, status chips, review panels, audit trails, and concise headings.
- Use motion sparingly for state continuity, not decoration.
- Prefer exact operational copy over marketing language.
- Avoid decorative gradients, fake metric cards, generic feature blocks, emoji icons, and placeholder charts.
- Make empty states actionable and data-aware.
- Ensure all forms have labels, validation messages, keyboard support, visible focus states, and accessible contrast.

## Acceptance Criteria

- A new tenant can sign up, create an organisation, add members, define facilities/business units, and create reporting periods.
- An authorised user can import or manually create real activity records without static seed records appearing in production.
- A field worker can submit evidence through the mobile flow and see submission status.
- A reviewer can approve a field submission into an activity record.
- A calculation run creates immutable calculation rows and dashboard aggregates.
- A published snapshot can generate matching dashboard totals and report totals.
- Cross-tenant API access attempts are rejected in tests.
- CI passes for lint, typecheck, tests, web build, Flutter analyze, and Flutter tests.

## Assumptions

- Vercel is the production web host.
- Postgres and Prisma are the canonical database path.
- Better Auth remains the authentication system.
- Cloudflare R2-compatible storage is used for production artefacts; local storage is only for development.
- pg-boss is the production job queue.
- Construction field capture is the first vertical workflow, but the platform remains a broader SMB GHG accounting product.
