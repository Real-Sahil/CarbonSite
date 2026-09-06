# Zapier Integration Setup Guide

This document explains how to register the MetricOra app with Zapier Platform and configure it for use.

## Overview

The Zapier integration enables users to:
- Create activity records from any Zapier-connected app (Slack, Gmail, Stripe, QuickBooks, etc.)
- Create supplier accounts directly from CRM/HR systems
- Trigger reports based on external events
- Build custom automation workflows without coding

## Step 1: Register Zapier Platform App

1. Go to [https://platform.zapier.com/apps](https://platform.zapier.com/apps)
2. Click "Create New App" or "My Apps"
3. Fill in:
   - **App Name:** MetricOra
   - **App Description:** Emissions tracking platform for multi-tenant organizations
   - **Category:** Business Intelligence & Analytics
   - **Homepage URL:** https://metricora.co.uk
   - **Support Email:** support@metricora.co.uk

4. Click "Create"

## Step 2: Configure Authentication

1. In your Zapier app dashboard, go to "Authentication"
2. Choose **OAuth 2.0** for user-level auth (each org admin connects independently)
3. Fill in OAuth endpoints:

   | Field | Value |
   |-------|-------|
   | **Authorization URL** | `https://your-metricora-domain.com/api/zapier/oauth/authorize` |
   | **Access Token URL** | `https://your-metricora-domain.com/api/zapier/oauth/token` |
   | **Refresh URL** | `https://your-metricora-domain.com/api/zapier/oauth/refresh` |
   | **Scopes** | `read:organization write:records read:facilities` |

4. Set **Unique Redirect URI:** `https://zapier.com/oauth/callback/metricora`

5. Copy your Zapier credentials:
   - **Client ID** → `ZAPIER_CLIENT_ID`
   - **Client Secret** → `ZAPIER_CLIENT_SECRET`

## Step 3: Add Triggers

Go to "Triggers" in your Zapier app and create:

### Trigger 1: Activity Record Created

1. Click "Add Trigger"
2. **Name:** `activity_record.created`
3. **Noun:** Activity Record
4. **Description:** Triggers when a new emissions record is created
5. **Key:** activity_record.created
6. **Webhook URL:** `https://your-metricora-domain.com/api/zapier/webhooks`
7. **Output Fields:** 
   - quantity (number)
   - unit (text)
   - category (text)
   - description (text)
   - date (datetime)
   - facility_id (text)

### Trigger 2: Report Published (Optional)

1. Click "Add Trigger"
2. **Name:** `report.published`
3. **Description:** Triggers when a new report is published
4. **Output Fields:**
   - report_id (text)
   - type (text)
   - published_at (datetime)

## Step 4: Add Actions

Go to "Actions" and create:

### Action 1: Create Activity Record

1. Click "Add Action"
2. **Name:** `activity_record.create`
3. **Noun:** Activity Record
4. **Description:** Create a new activity record in MetricOra
5. **URL:** `https://your-metricora-domain.com/api/zapier/actions/activity-record-create`
6. **Method:** POST
7. **Auth:** OAuth 2.0
8. **Input Fields:**
   - `quantity` (number, required)
   - `unit` (dropdown: kg, t, kWh, L, miles, etc.)
   - `category` (dropdown: s1-stationary, s2-electricity-lb, s3-business-travel, etc.)
   - `description` (text, optional)
   - `facility_id` (dropdown with dynamic resource, optional)
   - `date` (datetime, optional)

9. **Test Fields:** Add sample values for testing

### Action 2: Create Supplier

1. Click "Add Action"
2. **Name:** `supplier.create`
3. **Noun:** Supplier
4. **Description:** Create a new supplier account
5. **URL:** `https://your-metricora-domain.com/api/zapier/actions/supplier-create`
6. **Method:** POST
7. **Input Fields:**
   - `email` (email, required)
   - `name` (text, required)
   - `company` (text, optional)

## Step 5: Add Resource Methods

Resources allow dynamic dropdowns (e.g., facility lists change per org).

1. Go to "Resources" tab
2. Create three resources:

### Resource 1: Categories

- **Name:** Categories
- **Key:** categories
- **List URL:** `https://your-metricora-domain.com/api/zapier/resources?type=categories&orgId={{authData.organizationId}}`
- **ID Field:** id
- **Label Field:** name

### Resource 2: Facilities

- **Name:** Facilities
- **Key:** facilities
- **List URL:** `https://your-metricora-domain.com/api/zapier/resources?type=facilities&orgId={{authData.organizationId}}`
- **ID Field:** id
- **Label Field:** name

### Resource 3: Units

- **Name:** Units
- **Key:** units
- **List URL:** `https://your-metricora-domain.com/api/zapier/resources?type=units`
- **ID Field:** id
- **Label Field:** name

## Step 6: Environment Variables

Set these in your `.env` files:

```bash
# Zapier Platform credentials (from Step 2)
ZAPIER_APP_ID=your_app_id_from_zapier
ZAPIER_APP_SECRET=your_app_secret_from_zapier
ZAPIER_CLIENT_ID=your_client_id_from_zapier
ZAPIER_CLIENT_SECRET=your_client_secret_from_zapier
ZAPIER_WEBHOOK_SECRET=your_webhook_secret_for_signature_verification
```

## Step 7: Test the Integration

1. In Zapier Platform, go to "Test & Publish"
2. Click "Test Trigger" on activity_record.created
3. Authorize with your MetricOra organization
4. Create a sample activity record in MetricOra
5. Verify the trigger fires

To test actions:
1. Click "Test Action" on activity_record.create
2. Enter sample values (quantity, unit, category, etc.)
3. Click "Create Test Record"
4. Verify the record appears in MetricOra

## Step 8: Publish to Zapier App Marketplace

Once testing passes:

1. Go to "Public" in your app settings
2. Click "Invite Beta Users" or "Publish" (requires review)
3. Add app description, screenshots, logo
4. Zapier will review and approve

## Example Zapier Workflows

### Workflow 1: Slack → MetricOra

1. Trigger: "New Slack message with file attachment"
2. Action: "Create Activity Record" (extract quantity from message)
3. Benefit: Facilities team uploads emission data directly from Slack

### Workflow 2: QuickBooks → MetricOra (Scope 3)

1. Trigger: "New QuickBooks purchase"
2. Filter: Category contains "Freight" or "Supplies"
3. Action: "Create Activity Record" (map amount to Scope 3 estimated emissions)
4. Benefit: Auto-import supplier spend data

### Workflow 3: Gmail → MetricOra (Utility Bills)

1. Trigger: "New email with attachment matching 'invoice'"
2. Action: "Create Activity Record" (OCR extracts kWh, attach to Facilities)
3. Benefit: Paperless utility bill ingestion

### Workflow 4: Salesforce → MetricOra (Supplier Onboarding)

1. Trigger: "New Salesforce contact created"
2. Filter: Account type = "Supplier"
3. Action: "Create Supplier" (name, email → MetricOra)
4. Benefit: Supplier accounts auto-created from CRM

## Monitoring & Debugging

Check Zapier App logs at:
- **Zapier Platform Dashboard** → "Logs" tab
- **MetricOra API** → Check `/api/zapier/*` endpoints in server logs
- **Webhook Deliveries** → Verify signatures in `lib/integrations/zapier.ts`

Common issues:

| Issue | Solution |
|-------|----------|
| "Authentication failed" | Verify ZAPIER_CLIENT_ID/SECRET in .env |
| "Resource dropdown empty" | Check organization has facilities/categories |
| "Webhook signature invalid" | Verify ZAPIER_WEBHOOK_SECRET matches Zapier settings |
| "OAuth redirect fails" | Ensure redirect URI matches exactly in Zapier settings |

## Production Checklist

- [ ] Create real Zapier Platform app (not test)
- [ ] Set up production OAuth endpoints with HTTPS
- [ ] Configure ZAPIER_WEBHOOK_SECRET with secure random value
- [ ] Test all triggers and actions with real data
- [ ] Set up monitoring/alerting for webhook failures
- [ ] Document organization-specific setup (which facilities to assign, etc.)
- [ ] Train support team on Zapier troubleshooting
- [ ] Publish to marketplace or share beta invite link with customers

## API Reference

### Authentication Test

```bash
curl -X POST https://your-domain.com/api/zapier/auth/test \
  -H "Content-Type: application/json" \
  -d '{"authData":{"organizationId":"org_123"}}'
```

### Create Activity Record

```bash
curl -X POST https://your-domain.com/api/zapier/actions/activity-record-create \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "org_123",
    "quantity": 100,
    "unit": "kg",
    "category": "s1-stationary",
    "description": "Fuel consumption",
    "date": "2026-08-27T10:00:00Z"
  }'
```

### Get Resources (Categories)

```bash
curl "https://your-domain.com/api/zapier/resources?type=categories&orgId=org_123"
```

## Support

For issues or questions:
- Check logs in Zapier Platform dashboard
- Review MetricOra server logs for API errors
- Contact: dev@metricora.co.uk
