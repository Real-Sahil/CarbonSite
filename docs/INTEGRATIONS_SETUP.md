# MetricOra Integrations Setup Guide

This guide covers setting up third-party integrations without Docker, self-hosting, or paid infrastructure. All integrations use cloud SaaS platforms and serverless functions.

## Table of Contents
1. [LLM (AI Narratives)](#llm-ai-narratives)
2. [Xero Accounting](#xero-accounting)
3. [SSO / OIDC](#sso--oidc)
4. [n8n Workflows](#n8n-workflows)
5. [Environment Variables](#environment-variables)

---

## LLM (AI Narratives)

Generates audit narratives (Executive Summary, Key Findings, Recommendations) in PDF reports. No infrastructure required.

### Setup Steps

1. **Get HuggingFace Token** (Recommended)
   - Go to https://huggingface.co/settings/tokens
   - Create a new access token with "Read" permission
   - Copy the token (starts with `hf_...`)

2. **Set Environment Variable**
   - **Local Development:** Add to `.env.local`:
     ```
     HUGGINGFACE_TOKEN=hf_your_token_here
     ```
   - **Vercel Production:** Add to Vercel project settings (Settings → Environment Variables):
     ```
     HUGGINGFACE_TOKEN=hf_your_token_here
     ```

3. **Verify Configuration**
   - Start dev server: `pnpm dev`
   - Visit: http://localhost:3000/api/admin/health/llm
   - Expected response:
     ```json
     {
       "configured": true,
       "provider": "huggingface",
       "status": "ok",
       "message": "LLM provider is working correctly"
     }
     ```

### Fallback: NVIDIA NIM API (Optional)

If HuggingFace is unavailable:

1. **Get NVIDIA NIM API Key**
   - Go to https://build.nvidia.com/explore/discover
   - Create a free account
   - Generate API key from account settings
   - Copy the key (use as `NVIDIA_NIM_API_KEY`)

2. **Set Environment Variable**
   ```
   NVIDIA_NIM_API_KEY=your_key_here
   ```

### Testing Narratives

1. Generate a report: Navigate to Reports → Create Report
2. After generation completes, download PDF
3. Check if "Executive Summary" and "Key Findings" sections are populated
4. If empty, check worker logs: `tail -f .logs/worker.log`

---

## Xero Accounting

Auto-sync invoices from Xero to calculate Scope 3 supplier spend emissions.

### Prerequisites
- Xero account (free tier available: https://www.xero.com/signup)
- MetricOra organization with admin role

### Setup Steps

1. **Register Developer App on Xero**
   - Go to https://developer.xero.com/app/manage
   - Click "Create an app"
   - Name: "MetricOra"
   - Company name: Your organization
   - App type: "Web app"
   - Fill in redirect URL (see Step 2)
   - Save and note the credentials

2. **Get Your Redirect URL**
   - **Local Dev:** `http://localhost:3000/api/integrations/xero/callback`
   - **Production:** `https://your-domain.com/api/integrations/xero/callback`
   - Update this in your Xero developer app settings

3. **Set Environment Variables**
   - **Local Development (**.env.local):
     ```
     XERO_CLIENT_ID=your_client_id_here
     XERO_CLIENT_SECRET=your_client_secret_here
     XERO_REDIRECT_URI=http://localhost:3000/api/integrations/xero/callback
     ```
   - **Vercel Production:** Add same three variables to Vercel environment settings

4. **Connect Xero in App**
   - Login to your org as admin
   - Go to Settings → Integrations
   - Click "Connect Xero"
   - You'll be redirected to Xero login
   - Authorize the app (grant permissions)
   - You'll be redirected back with "✓ Xero connected" message

5. **Verify Setup**
   - Go to: `GET /api/admin/health/integrations?provider=xero`
   - Expected: `{ provider: "xero", connected: true, lastSync: "2026-08-29T..." }`

### Testing Sync

1. **Manual Trigger**
   - Create a test invoice in Xero with a supplier
   - Go to Settings → Data Connectors → Xero
   - Click "Sync Now" button
   - Check Audit Log for sync activity

2. **Auto Sync (Optional)**
   - Sync runs daily at 02:00 UTC
   - Or set via: Settings → Integration → Xero → Sync Schedule

3. **Verify Data**
   - Go to Activity Records
   - Filter by source: "xero:*"
   - Should see new records with supplier names and amounts

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "Xero OAuth not configured" | Set XERO_CLIENT_ID, XERO_CLIENT_SECRET in .env / Vercel |
| "Invalid redirect_uri" | Verify redirect URL matches exactly in Xero app settings |
| "Token refresh failed" | Check that refresh token wasn't revoked in Xero app settings |
| No invoices syncing | Ensure invoices are in "AUTHORISED" status in Xero |

---

## SSO / OIDC

Enable single sign-on (SSO) for enterprise users. Supports Okta, Azure AD, Google Workspace, and generic OIDC providers.

### Prerequisites
- OIDC-compatible identity provider (Okta, Azure AD, Google, etc.)
- Admin access to your identity provider
- MetricOra org with admin role

### Generic OIDC Setup (Google, Okta, Azure AD)

1. **Register App in Your Identity Provider**

   **Google Workspace:**
   - Go to https://console.cloud.google.com
   - Create new project
   - Enable OAuth 2.0 consent screen
   - Create OAuth 2.0 credential (type: Web application)
   - Authorized redirect URIs: `https://your-domain.com/api/auth/callback/oidc`

   **Okta:**
   - Go to your Okta admin dashboard
   - Applications → Create App Integration
   - Choose: OIDC - Web application
   - Grant type: "Authorization Code", "Refresh Token"
   - Redirect URIs: `https://your-domain.com/api/auth/callback/oidc`

   **Azure AD:**
   - Go to https://portal.azure.com
   - Azure Active Directory → App registrations → New registration
   - Redirect URI: `https://your-domain.com/api/auth/callback/oidc`
   - Create client secret (Certificates & secrets)

2. **Set Environment Variables**

   ```
   # OIDC Configuration
   OIDC_PROVIDER_ID=google          # or "okta", "azure", "generic"
   OIDC_CLIENT_ID=your_client_id
   OIDC_CLIENT_SECRET=your_client_secret
   OIDC_ISSUER_URL=https://accounts.google.com  # or your provider's issuer URL
   OIDC_SCOPE=openid email profile
   ```

   - **Local Dev:** Add to `.env.local`
   - **Production:** Add to Vercel environment variables

3. **Enable SSO in Organization Settings**
   - Login as org admin
   - Settings → Authentication → SSO/OIDC
   - Select provider from dropdown
   - Click "Enable SSO"

4. **Test SSO**
   - Logout of your org
   - Go to login page
   - Click "Sign in with [Provider]"
   - Should redirect to provider, then back to app
   - New user automatically provisioned with default role

### Role Mapping (Optional)

If you want to auto-assign roles based on identity provider groups:

1. **Configure Groups in Identity Provider**
   - Create groups: `metricora-admin`, `metricora-editor`, `metricora-viewer`
   - Assign users to groups

2. **Set Role Mapping** (in Vercel environment):
   ```
   OIDC_ROLE_MAPPING={"metricora-admin":"admin","metricora-editor":"editor","metricora-viewer":"viewer"}
   ```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid client" | Check OIDC_CLIENT_ID and OIDC_CLIENT_SECRET are correct |
| Redirect URI mismatch | Ensure `https://your-domain.com/api/auth/callback/oidc` is registered in your provider |
| User not provisioned | Check that OIDC_SCOPE includes `email` and `profile` |

---

## n8n Workflows

Automate business processes using n8n Cloud (no self-hosting required). Examples:
- Send Slack notifications when reports complete
- Create calendar events for reporting deadlines
- Email suppliers when their submissions are due

### Setup Steps

1. **Create n8n Account**
   - Go to https://n8n.cloud
   - Sign up (free tier available)
   - Create workspace

2. **Create Webhook Workflow**
   - In n8n: Create new workflow
   - Add node: Webhook (trigger)
   - Set HTTP method: POST
   - Copy webhook URL (e.g., `https://n8n.io/webhook/metricora-reports`)

3. **Configure MetricOra to Send Webhooks**
   - Login as org admin
   - Settings → Automations → Add Webhook
   - Paste n8n webhook URL
   - Select events: "report_ready", "import_failed", "submission_received"
   - Save

4. **Build n8n Workflow**
   - Example: Report ready notification
     ```
     Webhook (MetricOra sends report_ready event)
       ↓
     Function (extract report ID, org name)
       ↓
     Slack (send message: "Report for {org} is ready")
     ```

5. **Test Webhook**
   - In MetricOra: Create and complete a report
   - Check n8n execution history (should show incoming webhook)
   - Verify Slack message (or other action) was triggered

### Common n8n Workflows

**Workflow 1: Report Ready Notification**
```
Event: report_ready
→ Send Slack message to #sustainability channel
→ Send email to org admin with download link
```

**Workflow 2: Submission Reminder**
```
Trigger: Daily at 9 AM (n8n schedule)
→ Query MetricOra API: GET /api/orgs/{orgId}/field-submissions?status=pending
→ If count > 0: Send email to assigned reviewers
```

**Workflow 3: Auto-Approve Low-Risk Submissions**
```
Event: submission_received
→ Check if amount < $1,000 AND category = "s3-purchased-goods"
→ If yes: PATCH /api/orgs/{orgId}/field-submissions/{id} with status=approved
```

### Webhook Event Schema

All webhooks sent as POST with JSON body:

```json
{
  "event": "report_ready|import_failed|submission_received|calculation_complete",
  "organizationId": "org_123",
  "resourceId": "report_456",
  "timestamp": "2026-08-29T14:30:00Z",
  "data": {
    "reportType": "compliance|executive|internal",
    "period": "Q3 2026",
    "totalRecords": 1234,
    "downloadUrl": "https://..."
  }
}
```

---

## Environment Variables

### Complete Template

Create `.env.local` in project root (local dev) and add to Vercel (production):

```bash
# ─── LLM Configuration ──────────────────────────────────────────────────────
# Get token from: https://huggingface.co/settings/tokens
HUGGINGFACE_TOKEN=hf_your_token_here

# Alternative LLM (NVIDIA NIM) — optional, only if HuggingFace unavailable
NVIDIA_NIM_API_KEY=

# ─── Xero Integration ──────────────────────────────────────────────────────
# Register app at: https://developer.xero.com/app/manage
XERO_CLIENT_ID=your_client_id
XERO_CLIENT_SECRET=your_client_secret
XERO_REDIRECT_URI=http://localhost:3000/api/integrations/xero/callback  # Update for production

# ─── OIDC / SSO ────────────────────────────────────────────────────────────
# Identity provider type: google, okta, azure, generic
OIDC_PROVIDER_ID=google
OIDC_CLIENT_ID=your_oidc_client_id
OIDC_CLIENT_SECRET=your_oidc_client_secret
OIDC_ISSUER_URL=https://accounts.google.com
OIDC_SCOPE=openid email profile

# Optional: Auto-map identity provider groups to roles
OIDC_ROLE_MAPPING={"admin-group":"admin","editor-group":"editor"}

# ─── Webhooks ──────────────────────────────────────────────────────────────
# n8n Cloud webhook URLs for MetricOra to call
N8N_WEBHOOK_REPORTS=https://n8n.io/webhook/metricora-reports
N8N_WEBHOOK_SUBMISSIONS=https://n8n.io/webhook/metricora-submissions

# ─── Optional: Redis for Production Rate Limiting ──────────────────────────
# If not set, rate limiting falls back to PostgreSQL (slower but works)
REDIS_URL=redis://[:password@]host:port

# Database (required, usually pre-configured)
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...  # For Prisma migrations
```

### Validation Checklist

- [ ] LLM: `curl http://localhost:3000/api/admin/health/llm` returns `configured: true`
- [ ] Xero: App created at https://developer.xero.com/app/manage with correct redirect URI
- [ ] OIDC: App registered in your identity provider (Google/Okta/Azure)
- [ ] n8n: Webhook URLs copied from n8n workflows
- [ ] All env vars set in both `.env.local` (local dev) and Vercel dashboard (production)

---

## Monitoring & Troubleshooting

### Check Integration Status

```bash
# LLM status
curl http://localhost:3000/api/admin/health/llm

# Xero connection
curl http://localhost:3000/api/admin/health/integrations?provider=xero

# OIDC configuration
curl http://localhost:3000/api/admin/health/integrations?provider=oidc
```

### View Audit Logs

All integration activities are logged:
- Settings → Audit Trail
- Filter by: `action: "integration.connected"` or `"integration.disconnected"`
- Shows timestamp, actor, provider, and sync status

### Common Errors

| Error | Root Cause | Fix |
|-------|-----------|-----|
| "LLM not configured" | `HUGGINGFACE_TOKEN` or `NVIDIA_NIM_API_KEY` not set | Add token to `.env.local` / Vercel |
| "Xero OAuth not configured" | Missing `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` | Register app at developer.xero.com |
| "OIDC provider not found" | `OIDC_ISSUER_URL` incorrect | Verify issuer URL for your provider |
| "Webhook delivery failed" | n8n webhook URL invalid or network blocked | Test URL is accessible with `curl https://your-webhook-url` |

---

## Zero-Cost Architecture

All integrations use **free or pay-as-you-go** services:

| Integration | Service | Cost | Limit |
|---|---|---|---|
| LLM | HuggingFace Inference API | Free | 30 requests/min free tier |
| Accounting | Xero | Free (up to 20 users) | Unlimited for free plan |
| SSO/OIDC | Your identity provider | Free | Depends on provider |
| Workflows | n8n Cloud | Free (10 workflows, 10k executions/month) | $10/mo for unlimited |
| Rate Limiting | PostgreSQL | Included | Unlimited |
| Rate Limiting (faster) | Upstash Redis | Free ($7/month for small) | 10k commands/day free |

**No credit card required for MVP.** Upgrade to paid tiers only when exceeding free tier limits.

---

## Next Steps

1. ✅ Set `HUGGINGFACE_TOKEN` for AI narratives
2. ✅ Set `XERO_*` variables for accounting sync
3. ✅ Set `OIDC_*` variables for SSO (if using)
4. ✅ Create n8n workflows for automation
5. ✅ Test each integration with verification steps above
6. ✅ Commit `.env.local.example` (never commit secrets)
7. ✅ Deploy to Vercel and add environment variables there
