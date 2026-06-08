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
- `JOB_PROCESSING_MODE`

Use `STORAGE_DRIVER=r2` in production. Use `EMAIL_DRIVER=resend` when transactional email is configured. Use `JOB_PROCESSING_MODE=inline` for a Vercel-only deployment. Use `JOB_PROCESSING_MODE=worker` only after a separate `pnpm worker` process is deployed with the same database and storage secrets.

## Release Runbook

1. Apply Prisma migrations against the production database.
2. Run `pnpm prisma generate`.
3. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`.
4. Leave the Vercel Install Command unset. The repository pins Node and pnpm in `package.json`, and Vercel should infer pnpm from `pnpm-lock.yaml`.
5. Deploy the Next.js app through Vercel.
6. Keep `JOB_PROCESSING_MODE=inline` unless a worker runtime is already deployed.
7. If using worker mode, deploy or restart the worker runtime with the same database, storage, email, and Firebase secrets.
7. Confirm sign-in, organisation access, imports, submissions, reports, and targets against real organisation-scoped records.

## Vercel Build Command

The repository `vercel.json` sets `buildCommand` to `pnpm run build` and deliberately does not override the install command. Vercel's package-manager detection should use the committed `pnpm-lock.yaml` and the `packageManager` pin in `package.json`. If Vercel still reports a command such as `pmpn run build`, clear any dashboard-level Build Command override and redeploy from `main`.

## Worker Runtime

The worker entrypoint is `workers/index.ts` and the package script is `pnpm worker`. Host it on a long-running service such as Fly.io, Render, Railway, a VM, or a container platform. It must share the same `DATABASE_URL` and storage/email secrets as the Vercel app. Set `JOB_PROCESSING_MODE=worker` on the Vercel app only when that worker is healthy; otherwise leave inline mode enabled.
