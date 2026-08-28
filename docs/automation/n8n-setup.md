# n8n Workflow Orchestration Setup Guide

n8n is a low-code workflow automation platform that extends CarbonSite capabilities with automated workflows. It connects via webhooks — no additional infrastructure needed.

## Quick Start

### 1. Create n8n Instance

**Option A: n8n Cloud (Recommended)**
- Sign up: https://cloud.n8n.io
- Free tier: 100 executions/month, 1 workflow, 1 user
- No setup required — login and start building workflows

**Option B: Self-Hosted**
```bash
docker run -d --name n8n -p 5678:5678 n8n/n8n
# Access at http://localhost:5678
```

### 2. Configure CarbonSite Integration

Set environment variables:
```bash
# .env.production
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook
N8N_SIGNATURE_KEY=your-secret-key-here  # Optional: for webhook signature verification
```

On Vercel:
1. Go to Project Settings → Environment Variables
2. Add `N8N_WEBHOOK_URL` and `N8N_SIGNATURE_KEY`
3. Redeploy

### 3. Create Webhook Endpoint in n8n

All CarbonSite → n8n workflows use this pattern:
```
POST https://your-n8n-instance.com/webhook/{workflowName}

Headers:
  Content-Type: application/json
  X-N8N-Signature: ${N8N_SIGNATURE_KEY}

Body:
{
  "workflowName": "report-ready-notification",
  "orgId": "uuid",
  "timestamp": "2026-08-28T10:30:00Z",
  ... workflow-specific data
}
```

## Five Core Workflows

### Workflow 1: Field Worker Submission Reminder

**Purpose:** Alert reviewers about pending submissions older than 7 days

**Trigger:** Scheduled daily at 9 AM (set up in n8n cron)

**Steps:**
1. **Schedule trigger:** Set to run every day at 09:00 UTC
2. **Database query:**
   ```sql
   SELECT
     fs.id,
     fs.submitted_by_user_id,
     u.email AS submitter_email,
     fsreview.assigned_to_user_id,
     reviewer.email AS reviewer_email,
     fs.created_at
   FROM field_submissions fs
   JOIN users u ON fs.submitted_by_user_id = u.id
   LEFT JOIN field_submission_reviews fsreview ON fs.id = fsreview.submission_id
   LEFT JOIN users reviewer ON fsreview.assigned_to_user_id = reviewer.id
   WHERE fs.status = 'pending'
     AND fs.created_at < NOW() - INTERVAL '7 days'
     AND fs.organization_id = '${orgId}'
   ```
3. **For each submission:**
   - **Send Email to Reviewer:**
     ```
     To: {{reviewer.email}}
     Subject: Pending field submission for {{ submitter_email }} (7+ days)
     Body: Review and approve/reject ASAP to keep data pipeline moving
     ```

**Return to CarbonSite:** Optional webhook to /api/webhooks/n8n with:
```json
{
  "workflowName": "submission-reminder",
  "status": "success",
  "sentCount": 3
}
```

---

### Workflow 2: Facility Risk Flagging

**Purpose:** Automatically tag high-emission facilities

**Trigger:** CarbonSite webhook (when calculation run completes)

**CarbonSite Call:**
```typescript
// In lib/calculation/run-worker.ts (already added)
await triggerFacilityRiskFlag(orgId, calculationRunId);
```

**n8n Steps:**
1. **Webhook trigger** accepts: `{ orgId, calculationRunId }`
2. **Query DashboardAggregate for org:**
   ```sql
   SELECT
     facility_id,
     total_co2e,
     SUM(total_co2e) OVER () as org_total
   FROM dashboard_aggregates
   WHERE organization_id = '${orgId}'
   ORDER BY total_co2e DESC
   ```
3. **Calculate thresholds:**
   - High: > 75th percentile
   - Medium: > 50th percentile
   - Normal: < 50th percentile
4. **For each high-emission facility:**
   - Update via CarbonSite API:
     ```http
     PATCH /api/orgs/${orgId}/facilities/${facilityId}
     {
       "riskLevel": "high",
       "reason": "High emissions detected in latest calculation"
     }
     ```
   - Send Slack notification:
     ```
     Channel: #emissions-alerts
     Message: 🚨 Facility {{ facility_name }} flagged HIGH RISK
     ({{ total_co2e }} tonnes CO₂e in period)
     ```

**Return to CarbonSite:**
```json
{
  "workflowName": "facility-risk-update",
  "status": "success",
  "facilityId": "uuid",
  "riskLevel": "high"
}
```

---

### Workflow 3: Report Ready Notification

**Purpose:** Instant report notifications to creator + team

**Trigger:** CarbonSite webhook (when report status → 'ready')

**CarbonSite Call:**
```typescript
// In lib/reports/worker.ts (already added)
await triggerReportReadyNotification(
  orgId,
  reportId,
  reportType,
  creatorEmail
);
```

**n8n Steps:**
1. **Webhook trigger** accepts: `{ orgId, reportId, reportType, creatorEmail }`
2. **Send Email to Creator:**
   ```
   To: {{creatorEmail}}
   Subject: ✅ Your {{reportType}} report is ready
   Body: Download your report or share with stakeholders
   CTA: Visit dashboard to download
   ```
3. **Post to Slack:**
   ```
   Channel: #emissions-reports
   Notification: 📊 {{ reportType }} ready
   Creator: {{creatorEmail}}
   Link: [View Report](https://carbonsite.app/reports/{{reportId}})
   ```
4. **Optional: Create Slack thread** with report metadata

**Return to CarbonSite:**
```json
{
  "workflowName": "report-ready-notification",
  "status": "success",
  "emailSent": true,
  "slackPosted": true
}
```

---

### Workflow 4: Anomaly Alert

**Purpose:** Flag unusual emissions data for auditor review

**Trigger:** CarbonSite webhook (when anomaly score > threshold)

**CarbonSite Call:**
```typescript
await triggerAnomalyAlert(orgId, recordId, anomalyScore, severity);
```

**n8n Steps:**
1. **Parse anomaly details:**
   - Calculate impact: `(anomalyScore - baseline) / baseline * 100`
   - Determine severity: low (0.7-0.8), medium (0.8-0.9), high (>0.9)
2. **Create ReviewTask** via CarbonSite API:
   ```http
   POST /api/orgs/${orgId}/review-tasks
   {
     "targetType": "ActivityRecord",
     "targetId": "${recordId}",
     "priority": "{{ severity }}",
     "title": "Anomaly detected in record",
     "description": "Emission value deviates significantly from baseline"
   }
   ```
3. **Notify auditors:**
   - Email template: "Anomaly Review Required"
   - Slack: `#audit-alerts` channel

---

### Workflow 5: Supplier Data Request

**Purpose:** Auto-notify suppliers about data requests

**Trigger:** CarbonSite webhook (when new SupplierDataRequest created)

**CarbonSite Call:**
```typescript
await triggerSupplierDataRequest(orgId, supplierId, requestId, supplierEmail);
```

**n8n Steps:**
1. **Send email to supplier:**
   ```
   To: {{supplierEmail}}
   Subject: Data request from {{orgName}}: Please share emissions data
   Body: Help us calculate Scope 3 emissions
   CTA: [Submit Data](https://carbonsite.app/supplier/requests/{{requestId}})
   Deadline: 30 days
   ```
2. **Track submission status** (optional):
   - Set reminder for 14-day mark
   - Auto-escalate if no response after 28 days

---

## CarbonSite Webhook Integration

All workflows are triggered from CarbonSite via `lib/automation/n8n-client.ts`:

### Available Functions

```typescript
// Workflow triggers (call from CarbonSite)
await triggerSubmissionReminder(orgId);
await triggerFacilityRiskFlag(orgId, calculationRunId);
await triggerReportReadyNotification(orgId, reportId, reportType, creatorEmail);
await triggerAnomalyAlert(orgId, recordId, anomalyScore, severity);
await triggerSupplierDataRequest(orgId, supplierId, requestId, supplierEmail);
```

### Return Webhooks (n8n → CarbonSite)

n8n can call `POST /api/webhooks/n8n` to trigger state updates:

```typescript
// Example n8n HTTP node
POST https://carbonsite.app/api/webhooks/n8n
Headers:
  Content-Type: application/json
  X-N8N-Signature: ${N8N_SIGNATURE_KEY}

Body:
{
  "workflowName": "facility-risk-update",
  "orgId": "uuid",
  "status": "success",
  "data": {
    "facilityId": "uuid",
    "riskLevel": "high"
  }
}
```

---

## Testing Workflows

### Manual Test in n8n

1. Open workflow editor
2. Click **Test** (top right)
3. Provide test payload matching the trigger schema
4. Verify output in execution history

### Test from CarbonSite CLI

```bash
# Trigger submission reminder
curl -X POST http://localhost:3000/api/webhooks/n8n \
  -H "Content-Type: application/json" \
  -d '{
    "workflowName": "submission-reminder",
    "orgId": "org_uuid",
    "status": "success"
  }'
```

### Monitor Execution History

1. In n8n, open workflow
2. Click **Execution History** (left sidebar)
3. View each run's inputs, outputs, and errors
4. Re-run failed executions

---

## Monitoring & Alerts

### Track Workflow Execution

In n8n dashboard:
- View total executions per workflow
- Monitor error rates
- Set alerts for failures

### CarbonSite Logs

n8n logs are written to stdout:
```bash
[n8n] Workflow 'report-ready-notification' triggered successfully
[n8n webhook] Received workflow callback: status=success
```

Monitor in Vercel Functions logs or your hosting platform's logging service.

---

## Troubleshooting

### Workflow Not Triggering

1. **Verify env vars:** Check `N8N_WEBHOOK_URL` is set in `.env`
2. **Test connectivity:** 
   ```bash
   curl -X POST ${N8N_WEBHOOK_URL}/test -d '{"test": true}'
   ```
3. **Check n8n logs:** Open n8n and review execution history

### Webhook Signature Mismatch

- Set `N8N_SIGNATURE_KEY` to a shared secret
- In n8n, add HTTP auth header: `X-N8N-Signature: {{ signature }}`
- Optional: Remove signature verification in development

### Data Not Updating in CarbonSite

- Verify return webhook payload matches schema
- Check CarbonSite `/api/webhooks/n8n` is working:
  ```bash
  curl -X POST https://yourapp.com/api/webhooks/n8n \
    -H "Content-Type: application/json" \
    -d '{"workflowName":"test","orgId":"uuid","status":"success"}'
  ```
- Review server logs for parsing errors

---

## Best Practices

1. **Idempotency:** Workflows should handle duplicate execution
2. **Error Handling:** Set HTTP node to continue on error, log failures
3. **Rate Limiting:** n8n respects CarbonSite rate limits; add backoff
4. **Security:**
   - Use HTTPS URLs only
   - Rotate `N8N_SIGNATURE_KEY` monthly
   - Disable public webhook URLs in production
   - Restrict n8n IP addresses if possible

---

## Next Steps

1. Deploy n8n instance (cloud or self-hosted)
2. Set `N8N_WEBHOOK_URL` in production environment
3. Create one workflow at a time (start with Report Ready)
4. Test end-to-end with manual trigger
5. Enable scheduled workflows (submission reminder)
6. Monitor execution history and iterate
