# Vercel Email Invites

MetricOra sends account, member, and field-worker invite emails through the
transactional email driver in `lib/notifications/email.ts`. The production
driver is Resend.

## Vercel Setup

Use either the Resend Vercel integration or create a Resend account manually,
verify the sending domain, then add these variables to the Vercel project for
Production and Preview:

```bash
EMAIL_DRIVER=resend
RESEND_API_KEY=<resend-api-key>
EMAIL_FROM=MetricOra <onboarding@your-verified-domain>
```

Keep the app origin variables aligned with the deployed domain so invite links
open the correct Vercel app:

```bash
NEXT_PUBLIC_APP_URL=https://metricora-rosy.vercel.app
BETTER_AUTH_URL=https://metricora-rosy.vercel.app
TRUSTED_ORIGINS=https://metricora-rosy.vercel.app
```

If a custom domain is added later, update all three values to the custom HTTPS
origin and redeploy.

## Invite Behaviour

- Existing users are added to the organisation immediately and receive an access
  notification email.
- New admin, editor, reviewer, viewer, and auditor users receive an email-bound
  invite link. The invite acceptance page creates or signs into their web
  account before joining the organisation.
- New field workers receive a mobile invite. If they open the link in a browser,
  the page shows the invite token and tells them to continue in the MetricOra
  mobile app. The app creates the field profile, stores the bearer session, and
  then asks for the device PIN.
- If Resend is not configured or email delivery fails, the admin invite form
  still returns a copyable invite link so onboarding is not blocked.

## Smoke Test

1. Deploy with `EMAIL_DRIVER=resend`.
2. Open `/api/health` and confirm the environment check passes.
3. Sign in as an admin and open Members & Access.
4. Invite a normal web user and confirm the email arrives.
5. Invite a field worker and confirm the email arrives.
6. Paste the field-worker link or token into the mobile app and confirm the app
   reaches PIN setup after invite acceptance.
