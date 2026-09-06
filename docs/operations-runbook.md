# MetricOra Operations Runbook

This runbook is for operators of the production MetricOra deployment. It covers incident response, failed jobs, backup and restore, rollback, and post-release checks.

## 1. Incident Triage

Start with impact and scope:

- Public site unavailable: check the latest Vercel deployment for `main`, then `/api/health`.
- Signed-in workspace unavailable: check `/api/health`, database availability, and auth environment variables.
- Imports, calculations, or reports not completing: check `JOB_PROCESSING_MODE`, recent audit logs, and the relevant import, calculation run, or report status.
- Evidence uploads or downloads failing: check storage environment variables, bucket permissions, MIME and size policy, and signed URL generation.
- Mobile submissions not syncing: check app base URL, invite/session validity, evidence upload API, and field submission API status.

Use the Audit Trail page for tenant-scoped evidence of user-visible workflow events. Use provider logs for runtime failures.

## 2. Health Checks

After every release and during incidents:

```bash
curl https://<production-domain>/api/health
```

Expected result:

- HTTP `200`
- JSON includes `"ok": true`
- environment verification reports no missing keys
- database check is healthy

In production, health errors are intentionally redacted. Use Vercel/runtime logs to inspect details.

## 3. Job Processing

Default production mode:

```bash
JOB_PROCESSING_MODE=inline
```

Inline mode processes imports, calculations, reports, and notifications during the triggering request. This is safest until a separately hosted worker is deployed and monitored.

Worker mode:

```bash
JOB_PROCESSING_MODE=worker
pnpm worker
```

Only switch the web app to worker mode after the worker runtime is deployed with the same database, storage, email, route, and app URL environment variables.

## 4. Failed Job Recovery

Imports:

1. Open the Imports page for the affected organisation.
2. Find batches in `failed` or `needs_attention`.
3. Download the error CSV where available.
4. Correct the source file or mapping.
5. Upload a corrected file and commit only rows that validate.

Calculations:

1. Open Dashboard or the reporting period calculation runs.
2. Look for runs with `failed` status.
3. Check audit logs for `calculation.run_failed`.
4. Confirm every approved record has an emission category and a supported unit.
5. Confirm an approved factor exists for the selected factor library and activity date.
6. Fix the record or factor library, then trigger a new calculation run.

Reports:

1. Open Reports for the affected organisation.
2. Find reports with `failed` status.
3. Check audit logs for `report.failed`.
4. Confirm the snapshot still exists and report storage is writable.
5. Request a new report for the same published snapshot.

Notifications:

1. Check audit logs for `notification.*`.
2. Confirm `EMAIL_DRIVER`, `RESEND_API_KEY`, and `EMAIL_FROM`.
3. Re-trigger the source workflow when the notification is tied to a task, import, report, or submission.

## 5. Database Backups

Managed Postgres should have automated daily backups enabled before production traffic.

Minimum backup policy:

- Daily automated backups.
- Point-in-time recovery where the provider supports it.
- A tested restore procedure before the first pilot.
- Separate migration-capable and pooled connection strings where the provider recommends it.

Before any risky migration:

1. Confirm the latest automated backup timestamp.
2. Create an on-demand backup if supported.
3. Run migrations in a staging environment first.
4. Run `pnpm prisma migrate deploy` only after the backup is confirmed.

## 6. Restore Procedure

For full restore:

1. Freeze writes by disabling the production deployment or putting the app behind maintenance controls.
2. Restore the database to the target timestamp in the managed Postgres provider.
3. Point `DATABASE_URL` to the restored database if the provider creates a new instance.
4. Run `pnpm prisma generate`.
5. Run `/api/health`.
6. Validate organisation access, records, evidence downloads, calculations, reports, and audit trail.
7. Re-enable production traffic.

For object storage restore:

1. Identify affected storage keys from database rows or audit logs.
2. Restore objects from bucket versioning or provider backup where enabled.
3. Confirm `EvidenceFile`, `ImportBatch`, or `Report` rows still reference the restored keys.
4. Test signed download generation from the app.

## 7. Release Rollback

If a release breaks production:

1. Revert to the previous successful Vercel deployment.
2. Keep database migrations in mind: do not roll back app code past an irreversible schema migration without a database restore plan.
3. If a migration caused the issue, stop writes and follow the restore procedure.
4. Record the incident in operational notes with affected tenants, timing, root cause, and follow-up actions.

## 8. Security Response

For suspected tenant data exposure:

1. Disable affected user accounts or revoke memberships.
2. Preserve audit logs.
3. Review evidence downloads, report downloads, invite link usage, member changes, and field submissions.
4. Rotate affected secrets if storage, email, or database credentials may be compromised.
5. Invalidate active sessions if account compromise is suspected.
6. Document affected organisations, records, files, and remediation steps.

## 9. Mobile Release Operations

Android:

- Add Android signing secrets before producing Play Store-ready release artifacts. Without them, the workflow still builds Android artifacts with the debug signing fallback for CI verification.
- Use **Actions > Mobile release builds** or push a `v*` / `mobile-v*` tag.
- Download the APK and AAB artifacts from the workflow run.

iOS:

- The current workflow produces an unsigned iOS app artifact to prove the app compiles on macOS.
- Add a separate Apple signing lane before TestFlight or App Store delivery.

## 10. Post-Release Smoke Test

Run after every production deploy:

1. Public pages: `/`, `/product`, `/solutions/construction`, `/security`, `/resources`, `/contact`.
2. Auth: sign in or sign up.
3. Tenant: create or open an organisation.
4. Setup: create a reporting period, facility, and business unit.
5. Intake: create or import an activity record.
6. Evidence: upload and download evidence.
7. Field: accept an invite and submit mobile evidence.
8. Review: approve the field submission into an activity record.
9. Calculation: run and publish a snapshot.
10. Reporting: generate and download PDF and CSV artifacts.
11. Audit: confirm the material actions are visible in Audit Trail.
