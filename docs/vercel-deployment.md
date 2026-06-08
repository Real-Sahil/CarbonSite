# Vercel Production Deployment

CarbonSite is deployed as a Vercel Next.js application backed by managed Postgres, object storage, email, and optional pg-boss workers. The default Vercel mode processes imports, calculations, and report generation inline so user workflows do not get stranded when no separate worker is running.

## Required Services

- Vercel project connected to `Real-Sahil/CarbonSite`.
- Managed Postgres database with pooled and migration-capable connection strings.
- S3-compatible object storage, preferably Cloudflare R2, for evidence files and report artefacts.
- Resend or equivalent transactional email provider.
- Firebase Cloud Messaging credentials for the Flutter capture app.
- Optional separately hosted worker process for `pnpm worker` when throughput requires background processing.

## Vercel Environment

Set these variables for Production, Preview, and Development as appropriate:

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
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `ROUTING_PROVIDER`
- `POSTCODES_BASE_URL`
- `OSRM_BASE_URL`
- `JOB_PROCESSING_MODE`

Use `STORAGE_DRIVER=r2` in production. Use `EMAIL_DRIVER=resend` when transactional email is configured. Use `JOB_PROCESSING_MODE=inline` for a Vercel-only deployment. Use `JOB_PROCESSING_MODE=worker` only after a separate `pnpm worker` process is deployed with the same database and storage secrets.

## Release Runbook

1. Apply Prisma migrations against the production database.
2. Run `pnpm prisma generate`.
3. Run `pnpm verify:env` with the same environment variables that will be used by Vercel.
4. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`.
5. Leave the Vercel Install Command unset. The repository pins Node and pnpm in `package.json`, and Vercel should infer pnpm from `pnpm-lock.yaml`.
6. Deploy the Next.js app through Vercel.
7. Run `curl https://<your-vercel-domain>/api/health` and confirm the JSON response returns `"ok": true`, environment checks pass, and the database check is healthy.
8. Keep `JOB_PROCESSING_MODE=inline` unless a worker runtime is already deployed.
9. If using worker mode, deploy or restart the worker runtime with the same database, storage, email, and Firebase secrets.
10. Confirm sign-in, organisation access, imports, submissions, reports, and targets against real organisation-scoped records.

## Production Health Check

`GET /api/health` is safe to call from release automation after deployment. It does not return secret values. It confirms that the runtime has all required CarbonSite environment variables for the selected storage, email, routing, and job modes, then verifies database connectivity with a lightweight `SELECT 1`.

A healthy response returns HTTP `200` with `"ok": true`. A failed response returns HTTP `503` and includes the missing variable names or mode validation errors that must be fixed in Vercel before running product smoke tests.

## Vercel Build Command

The repository `vercel.json` sets `buildCommand` to `pnpm run build` and deliberately does not override the install command. Vercel's package-manager detection should use the committed `pnpm-lock.yaml` and the `packageManager` pin in `package.json`. If Vercel still reports a command such as `pmpn run build`, clear any dashboard-level Build Command override and redeploy from `main`.

## Worker Runtime

The worker entrypoint is `workers/index.ts` and the package script is `pnpm worker`. Host it on a long-running service such as Fly.io, Render, Railway, a VM, or a container platform. It must share the same `DATABASE_URL` and storage/email secrets as the Vercel app. Set `JOB_PROCESSING_MODE=worker` on the Vercel app only when that worker is healthy; otherwise leave inline mode enabled.
