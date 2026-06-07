# Vercel Production Deployment

CarbonSite is deployed as a Vercel Next.js application backed by managed Postgres, object storage, email, and a separate worker runtime for long-running jobs.

## Required Services

- Vercel project connected to `Real-Sahil/CarbonSite`.
- Managed Postgres database with pooled and migration-capable connection strings.
- S3-compatible object storage, preferably Cloudflare R2, for evidence files and report artefacts.
- Resend or equivalent transactional email provider.
- Firebase Cloud Messaging credentials for the Flutter capture app.
- A separately hosted worker process for `pnpm worker`; do not run pg-boss workers inside Vercel request handlers.

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

Use `STORAGE_DRIVER=r2` in production. Use `EMAIL_DRIVER=resend` when transactional email is configured.

## Release Runbook

1. Apply Prisma migrations against the production database.
2. Run `pnpm prisma generate`.
3. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`.
4. Deploy the Next.js app through Vercel.
5. Deploy or restart the worker runtime with the same database, storage, email, and Firebase secrets.
6. Confirm sign-in, organisation access, imports, submissions, reports, and targets against real organisation-scoped records.

## Worker Runtime

The worker entrypoint is `workers/index.ts` and the package script is `pnpm worker`. Host it on a long-running service such as Fly.io, Render, Railway, a VM, or a container platform. It must share the same `DATABASE_URL` and storage/email secrets as the Vercel app.
