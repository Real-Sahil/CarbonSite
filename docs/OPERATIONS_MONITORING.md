# Monitoring and logs: free setup

Two things need an account only the owner can create, so they are steps, not code. Both have free tiers (checked against the free-for-dev list on 3 October 2026; confirm the limits when you sign up).

## 1. External uptime monitor and status page

Why: `.github/workflows/uptime.yml` checks every 6 hours and spends GitHub Actions minutes (the repo is private and minutes are metered). An outside monitor checks every few minutes for nothing.

1. Create a free account with an uptime service (Better Stack's free plan lists ten monitors at three-minute checks and a status page; UptimeRobot and Checkly have free plans too).
2. Add three HTTP monitors against the live domain: `/`, `/sign-in`, and `/api/health` (expect HTTP 200 and the text `"status":"ok"`; the health route runs a database round trip and never returns error text).
3. Send alerts to a mailbox that is watched, and to a phone.
4. Optional: publish the provider's status page and link it from the site footer.
5. Once the monitor has run for a week, set `uptime.yml` to `workflow_dispatch` only (or delete it) so it stops using minutes.

## 2. Log drain with longer retention

Why: Vercel keeps runtime logs briefly, so an error report from a customer last week may have nothing behind it. Sentry holds errors, not request logs.

1. Create a free account with a log service (Better Stack Logs and Axiom both list a free tier).
2. In Vercel: Project Settings, Log Drains, add a drain to that service for Production only.
3. Do not log personal data. The app logs ids and route names; keep it that way (`pino` is the logger, `handleRouteError()` never logs request bodies).
4. Set the retention to the shortest that covers a support conversation (30 days is typical) and note it in the privacy policy's sub-processor list.

## Not needed

- Status checks inside the app: `/api/health` and `/api/admin/health/*` already exist.
- A second error tracker: Sentry is enough. GlitchTip or Bugsink (Sentry-compatible) are the fallback if the Sentry quota is hit.
