# Deployment Checklist

Pre-deployment verifications for CarbonSite production deployments.

## Database Security

### Row-Level Security (RLS) Bypass Verification

**Status:** RLS is configured but not enforced on the application layer (see SECURITY.md for details).

The Prisma connection to PostgreSQL authenticates as the `postgres` role, which must have `rolbypassrls = true` to bypass RLS policies. This allows the application to function normally. The RLS policies exist as a secondary defense layer for the Supabase PostgREST API surface only.

**Pre-deployment check:**
```bash
pnpm check:rls-bypass
```

This verifies that the production database role has RLS bypass enabled. The check queries `pg_roles.rolbypassrls` for the `postgres` role and fails if it's not `true`.

**Why this matters:**
- If RLS bypass is disabled, the application will fail (Prisma queries will be blocked by RLS)
- This should only change by explicit action, never silently
- The check ensures accidental configuration changes are caught

**Manual verification (if check fails):**
```sql
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'postgres';
-- Expected: postgres | t
```

## Environment Variables Setup

### Setting Environment Variables on Vercel

1. Go to your Vercel project dashboard: https://vercel.com/dashboard
2. Select your CarbonSite project
3. Click Settings → Environment Variables
4. Add the following variables:

#### Required for All Deployments
```
DATABASE_URL          (Neon Postgres connection string)
DIRECT_URL            (Same as DATABASE_URL for serverless functions)
BETTER_AUTH_SECRET    (Generate: openssl rand -hex 32)
BETTER_AUTH_URL       (Your production domain, e.g., https://carbonsite.example.com)
TRUSTED_ORIGINS       (Same as BETTER_AUTH_URL)
NEXT_PUBLIC_APP_URL   (Same as BETTER_AUTH_URL)
```

#### Payment Processing (Stripe) — Currently Using Test Keys
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_51234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn"
STRIPE_SECRET_KEY="sk_test_4eC39HqLyjWDarhtT7sF6Z8j2xyS6ZZH8byE9kJWh9mEPt3p8V8u"
STRIPE_WEBHOOK_SECRET="whsec_test_1234567890abcdefghijklmnopqrstuvwxyz"
STRIPE_PRICE_STARTER_MONTHLY="price_..."
STRIPE_PRICE_STARTER_ANNUAL="price_..."
STRIPE_PRICE_GROWTH_MONTHLY="price_..."
STRIPE_PRICE_GROWTH_ANNUAL="price_..."
```

**Note:** These are dummy test keys. When you have a Stripe account:
1. Go to https://dashboard.stripe.com/apikeys
2. Copy your test publishable key (pk_test_...) and secret key (sk_test_...)
3. Create a Product with 4 Prices (Starter/Growth × monthly/annual) and copy each Price ID into the `STRIPE_PRICE_*` vars above
4. Add a webhook endpoint at `https://your-domain.com/api/webhooks/stripe` subscribed to `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed` — copy its signing secret into `STRIPE_WEBHOOK_SECRET`
5. Update the Vercel environment variables with your actual keys
6. For production, use the live keys (pk_live_... and sk_live_)

#### Optional for Enhanced Features
```
STORAGE_DRIVER=r2       (Cloudflare R2 or "db" for serverless)
RESEND_API_KEY          (For transactional emails)
EMAIL_FROM              (Sender email address)
FIREBASE_SERVICE_ACCOUNT_JSON  (For Flutter push notifications)
```

### Stripe Test Mode Setup (No Account Required)

For development and testing without a Stripe account, the dummy keys above are sufficient. They allow:
- UI rendering (forms, dialogs)
- API endpoint validation
- Error handling testing

To actually process payments later:
1. Create a Stripe account: https://stripe.com
2. Get your test API keys from the dashboard
3. Update all three Stripe env vars on Vercel
4. Test with Stripe's test card numbers (e.g., 4242 4242 4242 4242)

## Deployment Steps

1. ✓ Verify dependencies are up-to-date (pnpm audit --prod)
2. ✓ Run typecheck and tests locally
3. ✓ Create and test migrations on a staging database
4. ✓ Verify RLS bypass status (`pnpm check:rls-bypass`)
5. ✓ Set environment variables on Vercel (see above)
6. Deploy migrations (`pnpm prisma migrate deploy` on production)
7. Deploy application code to Vercel/production environment
8. Monitor error tracking (Sentry) for the first 30 minutes
9. Verify payment forms render correctly (Settings → Billing → Payment Methods)
