# CarbonSite Setup Guide

This guide covers local development, production backend setup, Vercel deployment, storage, jobs, mobile builds, and release verification for CarbonSite.

## 1. Services

Required for production:

- Vercel for the Next.js web app.
- Managed Postgres for Prisma and Better Auth tables.
- Cloudflare R2 or another S3-compatible object store for evidence, import files, error exports, and report artefacts.
- Resend or another transactional email provider.
- Postcodes.io and OSRM-compatible routing endpoints for UK postcode route distance.
- Flutter build environment for the field capture app.

Optional for higher throughput:

- A long-running worker host for `pnpm worker` using the same database and storage credentials.
- Firebase Cloud Messaging credentials when push notifications are enabled.

## 2. Local Web Setup

1. Install Node.js 20 or newer.
2. Enable pnpm through Corepack or install pnpm 10.12.3.
3. Copy `.env.example` to `.env.local`.
4. Set `DATABASE_URL` to a local or managed Postgres database.
5. Set local development values:

```bash
STORAGE_DRIVER=local
EMAIL_DRIVER=console
JOB_PROCESSING_MODE=inline
BETTER_AUTH_URL=http://localhost:3000
TRUSTED_ORIGINS=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
POSTCODES_BASE_URL=https://api.postcodes.io
OSRM_BASE_URL=https://router.project-osrm.org
```

6. Install and generate Prisma:

```bash
pnpm install
pnpm prisma generate
pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev
```

7. Open `http://localhost:3000`.

## 3. Production Environment Variables

Set these in Vercel Production, Preview, and Development environments as needed:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `TRUSTED_ORIGINS`
- `NEXT_PUBLIC_APP_URL`
- `STORAGE_DRIVER`
- `STORAGE_ENDPOINT`
- `STORAGE_ACCESS_KEY_ID`
- `STORAGE_SECRET_ACCESS_KEY`
- `STORAGE_BUCKET`
- `EMAIL_DRIVER`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `ROUTING_PROVIDER`
- `POSTCODES_BASE_URL`
- `OSRM_BASE_URL`
- `JOB_PROCESSING_MODE`
- `FIREBASE_SERVICE_ACCOUNT_JSON` when push notifications are enabled

Recommended production values:

```bash
STORAGE_DRIVER=r2
EMAIL_DRIVER=resend
ROUTING_PROVIDER=osrm
JOB_PROCESSING_MODE=inline
```

Use `JOB_PROCESSING_MODE=worker` only after a separate worker runtime is deployed and healthy.

## 4. Database

1. Create a managed Postgres database.
2. Set `DATABASE_URL` in Vercel and the worker runtime.
3. Apply migrations before release:

```bash
pnpm prisma migrate deploy
pnpm prisma generate
pnpm prisma db seed
```

The seed loads global methodology, emission category, and approved factor library records. It does not create demo tenants or fake activity records.

## 5. Object Storage

Create an R2 bucket and S3 API credentials. Set:

```bash
STORAGE_DRIVER=r2
STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
STORAGE_ACCESS_KEY_ID=<r2-access-key>
STORAGE_SECRET_ACCESS_KEY=<r2-secret-key>
STORAGE_BUCKET=carbonsite
```

CarbonSite validates storage key shape for tenant-scoped evidence, imports, error exports, and reports. Production files are served through signed URLs.

## 6. Email

For development:

```bash
EMAIL_DRIVER=console
```

For production:

```bash
EMAIL_DRIVER=resend
RESEND_API_KEY=<resend-api-key>
EMAIL_FROM=noreply@your-domain
```

Transactional email is used for member invites, review tasks, report-ready notifications, import failures, and submission review notifications.

## 7. Route Distance

Default provider settings:

```bash
ROUTING_PROVIDER=osrm
POSTCODES_BASE_URL=https://api.postcodes.io
OSRM_BASE_URL=https://router.project-osrm.org
```

The backend geocodes UK postcodes, stores coordinates, caches route distances, and writes distance provenance onto field submissions and activity records.

## 8. Vercel Deployment

1. Connect Vercel to `Real-Sahil/CarbonSite`.
2. Leave Install Command unset.
3. Keep the repository build command as `pnpm run build`.
4. Set all production environment variables.
5. Deploy from `main`.
6. After deployment, run:

```bash
curl https://<your-vercel-domain>/api/health
```

The response should return HTTP `200` and `"ok": true`.

## 9. Worker Runtime

Inline mode is safest for a Vercel-only deployment:

```bash
JOB_PROCESSING_MODE=inline
```

For a separate worker runtime:

1. Deploy the repository to a long-running host.
2. Set the same database, storage, email, route, and app URL environment variables.
3. Set `JOB_PROCESSING_MODE=worker` in both the app and worker runtime.
4. Start the worker:

```bash
pnpm worker
```

The worker processes imports, calculations, reports, and notifications through pg-boss.

## 10. Flutter Field App

From `mobile/`:

```bash
flutter pub get
flutter analyze
flutter test
```

Build with the production backend URL:

```bash
flutter build apk --dart-define=CARBONSITE_API_BASE_URL=https://<your-vercel-domain>
flutter build ios --dart-define=CARBONSITE_API_BASE_URL=https://<your-vercel-domain>
```

The mobile app accepts field-worker invites, stores bearer sessions securely, captures OCR/GPS/evidence, queues submissions offline, uploads evidence through signed URLs, and submits to the org-scoped field submission APIs.

## 11. GitHub Actions Mobile Builds

Use **Actions > Mobile release builds > Run workflow** or push a `v*` / `mobile-v*` tag to produce mobile artifacts from the repository.

Inputs:

- `api_base_url`: the deployed CarbonSite web URL used by the mobile app.
- `build_android`: produces release APK and AAB artifacts.
- `build_ios`: produces an unsigned iOS app artifact on a macOS runner.

Android release artifacts require these repository secrets before the workflow runs:

- `CARBONSITE_ANDROID_KEYSTORE_BASE64`
- `CARBONSITE_ANDROID_KEYSTORE_PASSWORD`
- `CARBONSITE_ANDROID_KEY_ALIAS`
- `CARBONSITE_ANDROID_KEY_PASSWORD`

The iOS workflow intentionally uses `--no-codesign`; App Store or TestFlight delivery still needs an Apple signing lane with certificate and provisioning profile secrets.

## 12. Production Smoke Test

After deploy:

1. Open `/` and confirm the public website loads.
2. Open `/product`, `/solutions/construction`, `/security`, `/resources`, and `/contact`.
3. Run `/api/health` and confirm `"ok": true`.
4. Sign up or sign in.
5. Create an organisation.
6. Add reporting periods, facilities, and business units.
7. Import factor rows through Operations setup.
8. Create or import activity records.
9. Upload evidence and confirm signed download links work.
10. Accept a field-worker invite in the mobile app and submit evidence.
11. Review and approve the field submission into an activity record.
12. Run a calculation and publish a snapshot.
13. Request a report and download PDF and CSV artefacts.
14. Open the Audit Trail and confirm the actions are recorded.

## 13. Verification Commands

Run before pushing production changes:

```bash
pnpm verify:env
pnpm lint
pnpm typecheck
pnpm test
pnpm run build
```

Run mobile gates:

```bash
cd mobile
flutter analyze
flutter test
```

CI runs the same web and mobile checks on `main` and pull requests.

## 14. Operations Runbook

For production incident response, failed job recovery, backup and restore, rollback, and post-release smoke testing, use [CarbonSite Operations Runbook](./operations-runbook.md).
