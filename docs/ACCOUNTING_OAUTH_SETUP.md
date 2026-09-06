# Accounting OAuth Setup Guide

This guide walks through setting up OAuth 2.0 authentication for Xero, QuickBooks, and Sage accounting platforms to enable invoice syncing and Scope 3 emissions calculation.

## Table of Contents

1. [Xero Setup](#xero-setup)
2. [QuickBooks Setup](#quickbooks-setup)
3. [Sage Setup](#sage-setup)
4. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
5. [Testing & Verification](#testing--verification)

---

## Xero Setup

### Step 1: Register Developer App on Xero

1. Go to https://developer.xero.com/app/manage
2. Click **"Create an app"**
3. Fill in the form:
   - **App name:** "MetricOra"
   - **Company name:** Your organization name
   - **App type:** "Web app"
   - **Redirect URLs:** 
     - **Local dev:** `http://localhost:3000/api/auth/xero/callback`
     - **Production:** `https://your-domain.com/api/auth/xero/callback`
4. Accept the terms and click **"Create app"**
5. You'll see your **Client ID** and **Client Secret** — copy both

### Step 2: Set Environment Variables

**Local Development (`.env.local`):**
```bash
XERO_CLIENT_ID=your_client_id_from_xero
XERO_CLIENT_SECRET=your_client_secret_from_xero
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Production (Vercel Dashboard):**
1. Go to your Vercel project → Settings → Environment Variables
2. Add three variables:
   - `XERO_CLIENT_ID` = your client ID
   - `XERO_CLIENT_SECRET` = your client secret
   - `NEXT_PUBLIC_APP_URL` = your production domain (e.g., `https://metricora.example.com`)

### Step 3: Connect Xero in the App

1. Start the dev server: `pnpm dev`
2. Login to your MetricOra org as an admin
3. Navigate to **Integrations → Accounting Software**
4. Click **"Connect Xero"** button
5. You'll be redirected to Xero login
6. Authorize the app (grant permissions to read invoices and company info)
7. You'll be redirected back with a success message

### Step 4: Verify Connection

While signed in as an org admin, call the status endpoint (session cookie required, so use the browser or an authenticated request, not a bare curl):

```
GET /api/orgs/{orgId}/integrations/xero
```

```json
{
  "connected": true,
  "connectedAt": "2026-08-31T14:30:00Z",
  "accountName": "Your Xero Organisation",
  "scopes": ["openid", "profile", "email", "accounting.transactions.read", "accounting.contacts.read"],
  "tokenExpired": false
}
```

---

## QuickBooks Setup

### Step 1: Register Developer App on QuickBooks

1. Go to https://developer.intuit.com/app/developer/myapps
2. Click **"Create an app"**
3. Fill in the form:
   - **App name:** "MetricOra"
   - **App type:** "Business"
   - **Use case:** "Read accounting data"
4. You'll be taken to your app dashboard
5. Go to **Development** section (or your environment tab)
6. Under **Keys & OAuth**, copy:
   - **Client ID** (publicly visible)
   - **Client Secret** (keep private!)

### Step 2: Configure Redirect URI on QuickBooks

1. In your QuickBooks app dashboard, click **Settings** (or **OAuth settings**)
2. Under **Redirect URIs**, add:
   - **Local dev:** `http://localhost:3000/api/auth/quickbooks/callback`
   - **Production:** `https://your-domain.com/api/auth/quickbooks/callback`
3. Click **Save**

### Step 3: Set Environment Variables

**Local Development (`.env.local`):**
```bash
QUICKBOOKS_CLIENT_ID=your_client_id
QUICKBOOKS_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Production (Vercel Dashboard):**
1. Go to your Vercel project → Settings → Environment Variables
2. Add three variables:
   - `QUICKBOOKS_CLIENT_ID` = your client ID
   - `QUICKBOOKS_CLIENT_SECRET` = your client secret
   - `NEXT_PUBLIC_APP_URL` = your production domain

### Step 4: Connect QuickBooks in the App

1. Make sure dev server is running: `pnpm dev`
2. Login to your MetricOra org as an admin
3. Navigate to **Integrations → Accounting Software**
4. Click **"Connect QuickBooks"** button
5. You'll be redirected to QuickBooks login
6. Sign in with your QuickBooks account
7. Authorize the app (grant permissions)
8. You'll be redirected back with a success message

### Step 5: Verify Connection

While signed in as an org admin:

```
GET /api/orgs/{orgId}/integrations/quickbooks
```

```json
{ "connected": true, "connectedAt": "2026-08-31T14:30:00Z", "accountName": "Your Company", "tokenExpired": false }
```

Note: connecting QuickBooks stores the OAuth token, but invoice syncing itself
isn't implemented yet (no QuickBooks SDK integration) — see docs/ACCOUNTING_SYNC_SETUP.md.

---

## Sage Setup

### Step 1: Register Developer App on Sage

1. Go to https://developer.sage.com/
2. Click **"Register"** or login to your Sage account
3. Click **"Create an app"** or **"New application"**
4. Fill in the form:
   - **Application name:** "MetricOra"
   - **Application type:** "Web application"
   - **Description:** "Automated invoice and emissions tracking"
5. Under **Redirect URIs**, add:
   - **Local dev:** `http://localhost:3000/api/auth/sage/callback`
   - **Production:** `https://your-domain.com/api/auth/sage/callback`
6. Accept terms and click **"Save"** or **"Create"**
7. You'll see your **Client ID** and **Client Secret** — copy both

### Step 2: Set Environment Variables

**Local Development (`.env.local`):**
```bash
SAGE_CLIENT_ID=your_client_id
SAGE_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Production (Vercel Dashboard):**
1. Go to your Vercel project → Settings → Environment Variables
2. Add three variables:
   - `SAGE_CLIENT_ID` = your client ID
   - `SAGE_CLIENT_SECRET` = your client secret
   - `NEXT_PUBLIC_APP_URL` = your production domain

### Step 3: Connect Sage in the App

1. Start the dev server: `pnpm dev`
2. Login to your MetricOra org as an admin
3. Navigate to **Integrations → Accounting Software**
4. Click **"Connect Sage"** button
5. You'll be redirected to Sage login
6. Sign in with your Sage credentials
7. Authorize the app (grant permissions to read invoices)
8. You'll be redirected back with a success message

### Step 4: Verify Connection

While signed in as an org admin:

```
GET /api/orgs/{orgId}/integrations/sage
```

```json
{ "connected": true, "connectedAt": "2026-08-31T14:30:00Z", "accountName": "Your Business", "tokenExpired": false }
```

Note: connecting Sage stores the OAuth token, but invoice syncing itself
isn't implemented yet (no Sage SDK integration) — see docs/ACCOUNTING_SYNC_SETUP.md.

---

## Common Issues & Troubleshooting

### Issue: "Loading failed not configured"

**Cause:** OAuth credentials are not set in environment variables.

**Solution:**
1. Ensure `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` (and/or QB/Sage equivalents) are set
2. Verify variables are in `.env.local` for local dev
3. Check Vercel environment variables for production deployment
4. Restart dev server after updating `.env.local`: `pnpm dev`

### Issue: "Invalid redirect_uri" (OAuth provider error)

**Cause:** The redirect URI registered with the OAuth provider doesn't match what MetricOra is sending.

**Solution:**
1. Verify the redirect URI in your OAuth app settings matches exactly:
   - Local: `http://localhost:3000/api/auth/xero/callback` (for Xero)
   - Production: `https://your-domain.com/api/auth/xero/callback`
2. Check for trailing slashes or protocol differences (http vs https)
3. Make sure you registered the callback URI in ALL environments (dev, prod, etc.)

### Issue: "Token refresh failed"

**Cause:** OAuth token has expired and can't be refreshed, or refresh token was revoked.

**Solution:**
1. In your accounting platform (Xero/QB/Sage), revoke the MetricOra app's access:
   - **Xero:** Settings → Connected apps → find "MetricOra" → disconnect
   - **QuickBooks:** Account Settings → Security → Connected apps → revoke
   - **Sage:** Account Settings → Apps & integrations → revoke "MetricOra"
2. Re-authenticate: Go back to Integrations → Accounting Software → click "Connect [Provider]" again

### Issue: No invoices syncing

**Cause:** 
- Invoices haven't been retrieved since connection
- Invoices are in "Draft" status (not "Authorised")
- Sync hasn't been manually triggered

**Solution:**
1. Ensure invoices in your accounting system are in "Authorised" or "Open" status
2. Manually trigger sync: Integrations → Accounting Software → click "Sync Now"
3. Check logs for errors: `tail -f .logs/worker.log` (if using worker mode)
4. Verify sync job is queued: Check Activity Log for sync events

### Issue: "NEXT_PUBLIC_APP_URL not configured"

**Cause:** `NEXT_PUBLIC_APP_URL` environment variable is not set.

**Solution:**
1. Add to `.env.local`:
   ```bash
   NEXT_PUBLIC_APP_URL=http://localhost:3000  # for local dev
   ```
2. For production, add to Vercel:
   ```
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   ```
3. Restart dev server

---

## Testing & Verification

### Manual Testing Checklist

- [ ] **Xero:**
  - [ ] Create test invoice in Xero
  - [ ] Click "Connect Xero" — redirected to Xero login
  - [ ] Authorize app — redirected back with success
  - [ ] Click "Sync Now" — check Activity Log for sync events
  - [ ] Verify invoice appears in Activity Records with source "xero"

- [ ] **QuickBooks:**
  - [ ] Create test invoice in QuickBooks
  - [ ] Click "Connect QuickBooks" — redirected to QB login
  - [ ] Authorize app — redirected back with success
  - [ ] Click "Sync Now" — check Activity Log for sync events
  - [ ] Verify invoice appears in Activity Records with source "quickbooks"

- [ ] **Sage:**
  - [ ] Create test invoice in Sage
  - [ ] Click "Connect Sage" — redirected to Sage login
  - [ ] Authorize app — redirected back with success
  - [ ] Click "Sync Now" — check Activity Log for sync events
  - [ ] Verify invoice appears in Activity Records with source "sage"

### Connection Status

While signed in as an org admin, each provider has its own status endpoint:

```
GET /api/orgs/{orgId}/integrations/xero
GET /api/orgs/{orgId}/integrations/quickbooks
GET /api/orgs/{orgId}/integrations/sage
```

Each returns `{ connected, connectedAt, accountName, scopes, tokenExpired }`.
Only Xero actually syncs invoices today — see docs/ACCOUNTING_SYNC_SETUP.md
for what "connected" does and doesn't get you per provider.

### Monitoring

- **Audit Log:** All OAuth events (connection, disconnection, sync) logged
- **Activity Log:** Shows when invoices are synced and processed
- **Alerts:** Errors during sync are logged and can trigger notifications

---

## Next Steps

1. ✅ Register OAuth apps on Xero, QuickBooks, and/or Sage developer portals
2. ✅ Set `CLIENT_ID` and `CLIENT_SECRET` in `.env.local` and Vercel
3. ✅ Make sure `NEXT_PUBLIC_APP_URL` is set correctly
4. ✅ Connect accounting platform in MetricOra UI
5. ✅ Test invoice syncing by creating test invoices and clicking "Sync Now"
6. ✅ Monitor Activity Log for sync events and errors
7. ✅ Set up automated 2x daily sync (see docs/ACCOUNTING_SYNC_SETUP.md)

For additional help, see:
- [Accounting Sync Setup](./ACCOUNTING_SYNC_SETUP.md) — Configure automatic 2x daily syncing
- [Integrations Setup](./INTEGRATIONS_SETUP.md) — General integration guide
- [CLAUDE.md](../CLAUDE.md) — Architecture and environment variables reference
