# Phase 4 Progress

| # | Workstream | Status | Notes |
|---|---|---|---|
| UI | UI Overhaul | DONE | Light sidebar: white bg, sky-500 active, gray text. Mobile hamburger preserved. Collapse toggle updated. |
| 1 | Billing | DONE | BillingSubscription + UsageEvent models. Migration. lib/billing/usage.ts + limits.ts. GET /api/orgs/[orgId]/billing/usage. Settings page with usage meters + plan comparison table. |
| 2 | Advanced Analytics | Pending | PostHog cloud script injection |
| 3 | User Onboarding | Pending | Guided first-use flows |
| 4 | White-Label | Partial | TenantBranding model + branding settings already present |
| 5 | Monitoring | Partial | Health endpoint live (`/api/health`): env, database, auth-schema, storage checks; Grafana Cloud wiring pending |
| 6 | Data Residency | Pending | Org-level region tagging |
| 7 | Partner Ecosystem | Pending | Partner portal + revenue share |
| 8 | SOC 2 / GDPR | Pending | Compliance docs + DPA template |

## UI Overhaul details

- `components/org-sidebar.tsx`: replaced dark `#091910` / emerald theme with white bg, `border-gray-200`, `bg-sky-50 text-sky-700` active items, `text-gray-600` default
- `app/globals.css`: updated `--color-sky-blue` to `#0EA5E9`, `--color-cta-orange` to `#F97316`, added `--color-surface #F9FAFB`, `--color-sky-light #E0F2FE`
- Mobile top bar + drawer: white bg, sky logo mark, gray icons
- Collapse toggle: `border-gray-200 bg-white` replacing emerald border

## Billing details

### Prisma models
- `BillingSubscription` (1:1 per org) - plan, status, trial_ends_at, period dates
- `UsageEvent` - event_type, quantity, metadata, recorded_at. Indexed on (org_id, event_type, recorded_at)

### Plan limits (lib/billing/limits.ts)
| Plan | Submissions/mo | Reports/mo | Members | Price |
|---|---|---|---|---|
| Trial | 50 | 2 | 3 | Free |
| Starter | 500 | 10 | 10 | £49/mo |
| Growth | 5,000 | 50 | 50 | £149/mo |
| Enterprise | Unlimited | Unlimited | Unlimited | Custom |

### API
`GET /api/orgs/[orgId]/billing/usage` - admin only, returns plan + subscription + usage totals + limits

### Settings UI
`/settings/billing` - usage meters with colour-coded bars (sky/orange/red), plan comparison table, upgrade CTA
