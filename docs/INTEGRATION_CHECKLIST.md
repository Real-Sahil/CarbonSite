# Integration Setup Checklist

Track your progress setting up no-Docker integrations. Estimated total time: 30-45 minutes.

## LLM (AI Narratives)

Generates Executive Summary, Key Findings, and Recommendations in PDF reports.

- [ ] Get HuggingFace token from https://huggingface.co/settings/tokens
- [ ] Add `HUGGINGFACE_TOKEN=hf_...` to `.env.local` (local dev)
- [ ] Add `HUGGINGFACE_TOKEN` to Vercel environment variables (production)
- [ ] Test: `curl http://localhost:3000/api/admin/health/llm`
- [ ] Expected: `"configured": true, "status": "ok"`
- [ ] Generate a report and verify AI-generated sections appear in PDF

**Status:** ⏳ Not Started | ⚙️ In Progress | ✅ Complete

---

## Xero Accounting

Auto-sync invoices to calculate Scope 3 supplier emissions.

### Prerequisites
- [ ] Create Xero account (free tier available)
- [ ] Access to Xero admin dashboard

### Setup
- [ ] Register OAuth app at https://developer.xero.com/app/manage
- [ ] Save Client ID and Client Secret
- [ ] Set redirect URI: `http://localhost:3000/api/integrations/xero/callback` (local) or your production domain
- [ ] Add to `.env.local`:
  ```
  XERO_CLIENT_ID=...
  XERO_CLIENT_SECRET=...
  XERO_REDIRECT_URI=http://localhost:3000/api/integrations/xero/callback
  ```
- [ ] Add same three variables to Vercel environment variables
- [ ] Login to CarbonSite as org admin
- [ ] Go to Settings → Integrations → Connect Xero
- [ ] Authorize CarbonSite to access your Xero account
- [ ] Verify: Settings → Integrations shows "✓ Xero connected"
- [ ] Test sync: Create invoice in Xero, click "Sync Now"
- [ ] Verify: Check Activity Records for new entries with `source: "xero:*"`

**Status:** ⏳ Not Started | ⚙️ In Progress | ✅ Complete

---

## SSO / OIDC

Enable single sign-on for enterprise users (Google Workspace, Okta, Azure AD, or generic OIDC).

### Prerequisites (Choose One)
- [ ] Google Workspace admin account
- [ ] Okta admin account
- [ ] Azure AD tenant admin account
- [ ] Generic OIDC provider (other IdP)

### Setup

**For Google:**
1. [ ] Go to https://console.cloud.google.com
2. [ ] Create new project
3. [ ] Enable OAuth 2.0 consent screen
4. [ ] Create OAuth 2.0 credential (Web application)
5. [ ] Add redirect URI: `https://your-domain.com/api/auth/callback/oidc`
6. [ ] Copy Client ID and Client Secret

**For Okta:**
1. [ ] Go to Okta admin dashboard
2. [ ] Applications → Create App Integration
3. [ ] Choose: OIDC - Web application
4. [ ] Add redirect URI: `https://your-domain.com/api/auth/callback/oidc`
5. [ ] Copy Client ID and Client Secret

**For Azure AD:**
1. [ ] Go to https://portal.azure.com
2. [ ] Azure Active Directory → App registrations → New registration
3. [ ] Add redirect URI: `https://your-domain.com/api/auth/callback/oidc`
4. [ ] Create client secret
5. [ ] Copy Application ID and secret value

### Configuration
- [ ] Set environment variables (all environments):
  ```
  OIDC_PROVIDER_ID=google          # or okta, azure, generic
  OIDC_CLIENT_ID=...
  OIDC_CLIENT_SECRET=...
  OIDC_ISSUER_URL=...              # e.g., https://accounts.google.com
  OIDC_SCOPE=openid email profile
  ```
- [ ] Optional: Configure role mapping:
  ```
  OIDC_ROLE_MAPPING={"admin-group":"admin","editor-group":"editor"}
  ```
- [ ] Add to Vercel environment variables
- [ ] Test: Logout → Login page → Click "Sign in with [Provider]"
- [ ] Verify: New user provisioned with correct role

**Status:** ⏳ Not Started | ⚙️ In Progress | ✅ Complete

---

## n8n Workflows

Automate business processes without code (report notifications, submission reminders, etc.).

### Setup
- [ ] Go to https://n8n.cloud
- [ ] Sign up for free account
- [ ] Create new workflow
- [ ] Add Webhook trigger node
- [ ] Copy webhook URL: `https://n8n.io/webhook/...`
- [ ] In CarbonSite: Settings → Automations → Add Webhook
- [ ] Paste webhook URL
- [ ] Select events: `report_ready`, `import_failed`, `submission_received`
- [ ] Save
- [ ] Build workflow in n8n (example: send Slack message)
- [ ] Test: Complete a report in CarbonSite
- [ ] Verify: Check n8n execution history and Slack message received

### Common Workflows
- [ ] Report ready → Slack notification
- [ ] Report ready → Email to org admin
- [ ] Daily check → Remind reviewers of pending submissions
- [ ] Submission received → Slack in #sustainability channel
- [ ] Calculation complete → Update team calendar

**Status:** ⏳ Not Started | ⚙️ In Progress | ✅ Complete

---

## Deployment Checklist

### Before Pushing to Production
- [ ] All environment variables set in Vercel dashboard
- [ ] Run `pnpm typecheck` — no errors
- [ ] Run `pnpm lint` — no errors
- [ ] Run `pnpm test` — all tests pass
- [ ] Test LLM: `curl https://your-domain.com/api/admin/health/llm`
- [ ] Test Xero: Generate a report with Xero invoices
- [ ] Test SSO: Login with OAuth provider
- [ ] Test n8n: Complete a report and verify webhook delivery

### Post-Deployment
- [ ] Monitor Vercel logs for errors
- [ ] Check Audit Trail for integration events
- [ ] Verify user feedback (AI narratives appearing, Xero syncing, SSO working)

**Status:** ⏳ Not Started | ⚙️ In Progress | ✅ Complete

---

## Troubleshooting Quick Links

| Issue | Link |
|-------|------|
| "LLM not configured" | See INTEGRATIONS_SETUP.md → LLM section |
| "Xero OAuth error" | See INTEGRATIONS_SETUP.md → Xero Troubleshooting table |
| "OIDC provider not found" | See INTEGRATIONS_SETUP.md → SSO Troubleshooting table |
| "Webhook delivery failed" | Check n8n webhook URL is accessible |

---

## Support Resources

- **Full Setup Guide:** `docs/INTEGRATIONS_SETUP.md`
- **Environment Variables:** `.env.example`
- **API Health Check:** `/api/admin/health/llm`, `/api/admin/health/integrations`
- **Audit Trail:** Settings → Audit Trail (filter by provider)
- **Worker Logs:** Check Vercel logs or local worker output

---

## Estimated Timeline

| Integration | Setup Time | Ongoing Effort |
|---|---|---|
| LLM | 5 min | None (automatic) |
| Xero | 15 min | Low (daily auto-sync) |
| SSO | 15 min | None (automatic) |
| n8n | 10 min | Medium (workflow management) |
| **TOTAL** | **45 min** | Low-Medium |

---

**Last Updated:** 2026-08-29
**Status:** Ready for implementation
