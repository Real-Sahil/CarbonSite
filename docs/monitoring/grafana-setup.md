# Grafana Cloud Monitoring Setup Guide

This guide walks through setting up real-time monitoring for CarbonSite using Grafana Cloud's free tier.

## Account Setup (Free Tier)

1. **Create Grafana Cloud Account**
   - Visit https://grafana.com/auth/sign-up/create-account
   - Free tier includes: 3 users, 3 dashboards, 10 GB logs/month
   - No credit card required

2. **Create PostgreSQL Data Source**
   - Navigate to Configuration → Data Sources
   - Click "Add data source" → Select "PostgreSQL"
   - Configure:
     - **Host:** Your Neon Postgres hostname (from `.env` DATABASE_URL)
     - **Database:** carbonsite
     - **User:** postgres (or your Neon user)
     - **Password:** Your Neon password
     - **SSL Mode:** require (Neon requires SSL)
   - Click "Save & test" — should return "Database connection OK"

3. **Enable Auto-provisioning (Optional)**
   - Settings → Organizations → Auto-provision organizations
   - Allows team members to auto-create accounts on first login

## Dashboard 1: Report Generation Pipeline

**Purpose:** Monitor report generation status, generation time, and failure rates.

**SQL Queries:**

```sql
-- Panel 1: Reports by Status (Pie Chart)
SELECT 
  status,
  COUNT(*) as count
FROM reports
WHERE organization_id = $__variable('org_id')
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY status
ORDER BY count DESC
```

```sql
-- Panel 2: Average Generation Time (Stat)
SELECT 
  AVG(EXTRACT(epoch FROM published_at - created_at)) as avg_seconds
FROM reports
WHERE organization_id = $__variable('org_id')
  AND status = 'ready'
  AND published_at IS NOT NULL
  AND published_at > NOW() - INTERVAL '7 days'
```

```sql
-- Panel 3: Failed Reports Last 24h (Stat)
SELECT COUNT(*) as failed_count
FROM reports
WHERE organization_id = $__variable('org_id')
  AND status = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours'
```

```sql
-- Panel 4: Report Generation Timeline (Time Series)
SELECT
  DATE_TRUNC('hour', created_at) as time,
  status,
  COUNT(*) as count
FROM reports
WHERE organization_id = $__variable('org_id')
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY time, status
ORDER BY time DESC
```

**Alert Configuration:**
- **Name:** Report Generation Failures
- **Condition:** failed_count > 5 in last 24h
- **Notification:** Slack webhook to #alerts channel
- **Severity:** CRITICAL

---

## Dashboard 2: Data Quality Checks

**Purpose:** Monitor data import quality scores and validation failure rates.

**SQL Queries:**

```sql
-- Panel 1: Quality Score Distribution (Gauge)
SELECT 
  ROUND(AVG(overall_score), 1) as quality_score
FROM import_batch_quality_scores
WHERE organization_id = $__variable('org_id')
  AND created_at > NOW() - INTERVAL '7 days'
```

```sql
-- Panel 2: Checks Passed by Type (Bar Chart)
SELECT
  check_type,
  SUM(CASE WHEN passed = true THEN 1 ELSE 0 END) as passed,
  COUNT(*) as total
FROM data_quality_checks
WHERE organization_id = $__variable('org_id')
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY check_type
ORDER BY check_type
```

```sql
-- Panel 3: Quality Score Over Time (Time Series)
SELECT
  DATE_TRUNC('day', created_at) as time,
  ROUND(AVG(overall_score), 1) as avg_score,
  MIN(overall_score) as min_score,
  MAX(overall_score) as max_score
FROM import_batch_quality_scores
WHERE organization_id = $__variable('org_id')
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY time
ORDER BY time DESC
```

```sql
-- Panel 4: Imports Below 80% Threshold (Stat)
SELECT COUNT(*) as low_quality_imports
FROM import_batch_quality_scores
WHERE organization_id = $__variable('org_id')
  AND overall_score < 80
  AND created_at > NOW() - INTERVAL '24 hours'
```

**Alert Configuration:**
- **Name:** Low Data Quality Imports
- **Condition:** avg_score < 70 in last 24h
- **Notification:** Slack webhook to #quality channel
- **Severity:** WARNING

---

## Dashboard 3: Import Processing Performance

**Purpose:** Monitor import processing times, row counts, and success rates.

**SQL Queries:**

```sql
-- Panel 1: Imports by State (Pie Chart)
SELECT 
  state,
  COUNT(*) as count
FROM import_batches
WHERE organization_id = $__variable('org_id')
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY state
ORDER BY count DESC
```

```sql
-- Panel 2: Average Processing Time by State (Bar Chart)
SELECT
  state,
  ROUND(AVG(EXTRACT(epoch FROM updated_at - created_at))::numeric, 1) as avg_seconds
FROM import_batches
WHERE organization_id = $__variable('org_id')
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY state
ORDER BY avg_seconds DESC
```

```sql
-- Panel 3: Processing Time Over Time (Time Series)
SELECT
  DATE_TRUNC('hour', created_at) as time,
  ROUND(AVG(EXTRACT(epoch FROM updated_at - created_at))::numeric, 1) as avg_seconds
FROM import_batches
WHERE organization_id = $__variable('org_id')
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY time
ORDER BY time DESC
```

```sql
-- Panel 4: Slow Imports (>30min) in Last 24h (Stat)
SELECT COUNT(*) as slow_imports
FROM import_batches
WHERE organization_id = $__variable('org_id')
  AND EXTRACT(epoch FROM updated_at - created_at) > 1800  -- 30 minutes
  AND created_at > NOW() - INTERVAL '24 hours'
```

**Alert Configuration:**
- **Name:** Slow Import Processing
- **Condition:** avg_seconds > 1800 in last 1h
- **Notification:** Slack webhook to #ops channel
- **Severity:** WARNING

---

## Dashboard 4: Field Submission Approvals

**Purpose:** Monitor field worker submissions, approval rates, and review queue health.

**SQL Queries:**

```sql
-- Panel 1: Submissions by Status (Pie Chart)
SELECT 
  review_status,
  COUNT(*) as count
FROM field_submissions
WHERE organization_id = $__variable('org_id')
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY review_status
ORDER BY count DESC
```

```sql
-- Panel 2: Pending Submissions by Age (Table)
SELECT
  id,
  source_description,
  data_format,
  ROUND(EXTRACT(epoch FROM (NOW() - created_at))::numeric / 3600, 1) as hours_pending,
  evidence_file_count
FROM field_submissions
WHERE organization_id = $__variable('org_id')
  AND review_status = 'pending'
ORDER BY created_at ASC
LIMIT 10
```

```sql
-- Panel 3: Approval Rate Over Time (Time Series)
SELECT
  DATE_TRUNC('day', created_at) as time,
  SUM(CASE WHEN review_status = 'approved' THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as approval_rate_pct
FROM field_submissions
WHERE organization_id = $__variable('org_id')
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY time
ORDER BY time DESC
```

```sql
-- Panel 4: Average Review Time (Stat)
SELECT 
  ROUND(AVG(EXTRACT(epoch FROM (reviewed_at - created_at)) / 60)::numeric, 1) as avg_minutes
FROM field_submissions
WHERE organization_id = $__variable('org_id')
  AND reviewed_at IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'
```

**Alert Configuration:**
- **Name:** High Pending Submissions
- **Condition:** pending_count > 20
- **Notification:** Slack webhook to #submissions channel
- **Severity:** INFO

---

## Alert Notification Channels

### Slack Integration

1. Create Slack Incoming Webhook:
   - Go to your Slack workspace settings → Apps → Manage Apps
   - Search "Incoming Webhooks" → click to install
   - Click "Add New Webhook to Workspace"
   - Select target channel (e.g., #alerts)
   - Copy webhook URL

2. Add to Grafana:
   - Settings → Notification channels → New channel
   - Type: Slack
   - Webhook URL: Paste from step 1
   - Test connection

3. Attach to Alerts:
   - Edit alert rule
   - Under "Send to": Select Slack channel
   - Save

### Email Notifications (Optional)

If Slack isn't available:
- Settings → Notification channels → New channel
- Type: Email
- Email address: ops@company.com
- Test connection

---

## Dashboard Variables (Org Scoping)

To filter dashboards by organization:

1. **Add Variable to Each Dashboard:**
   - Edit dashboard → Dashboard settings → Variables
   - Click "New"
   - **Name:** `org_id`
   - **Type:** Query
   - **Data source:** PostgreSQL
   - **Query:**
     ```sql
     SELECT DISTINCT organization_id FROM import_batches ORDER BY organization_id
     ```

2. **Reference in Queries:**
   All SQL queries above use `$__variable('org_id')` to filter. Update the dashboard dropdown to select org.

---

## Maintenance & Best Practices

### Daily
- Monitor alert notifications in Slack
- Review failed reports on Report Generation dashboard
- Check Data Quality scores for trending issues

### Weekly
- Review Field Submission approval times (target: < 2 hours average)
- Audit Import Processing performance for slowdowns
- Update alert thresholds if patterns change

### Monthly
- Export dashboard reports (PDF) for stakeholder review
- Archive old dashboards (>6 months unused)
- Review Grafana Cloud usage (logs, dashboard count)

### Performance Tuning
- **Slow queries?** Add indexes on filtered columns:
  ```sql
  CREATE INDEX idx_reports_org_status ON reports(organization_id, status, created_at);
  CREATE INDEX idx_quality_scores_org ON import_batch_quality_scores(organization_id, created_at);
  CREATE INDEX idx_field_submissions_org ON field_submissions(organization_id, review_status, created_at);
  ```

- **Too many dashboards?** Archive low-traffic ones in Grafana (Settings → Dashboards → Archive)

---

## Security Considerations

1. **Database Credentials**
   - Never commit `.env` with DATABASE_URL to GitHub
   - Grafana stores credentials encrypted in cloud
   - Rotate Neon Postgres password quarterly

2. **Access Control**
   - Invite only ops/eng team to Grafana (free tier: 3 users)
   - Disable anonymous dashboard access (Settings → Security)
   - Use Grafana org-level RBAC (Viewer, Editor, Admin)

3. **Data Exposure**
   - Queries filter by `organization_id` — no cross-tenant data leakage
   - Avoid including PII in dashboard titles/descriptions

---

## Cost Breakdown

| Component | Free Tier | Cost |
|-----------|-----------|------|
| Grafana Cloud | 3 users, 3 dashboards, 10 GB logs/month | $0 |
| PostgreSQL (Neon) | 0.5 GB storage, 100 compute-hours/month | $0 |
| Slack (optional) | Standard workspace | $0-8/user/month |
| **TOTAL** | | **$0** (if no Slack paid workspace) |

---

## Troubleshooting

**"Database connection failed"**
- Verify DATABASE_URL in `.env` is correct
- Check Neon password hasn't expired
- Ensure SSL is enabled (Neon requires it)
- Test connection: `psql $DATABASE_URL`

**"Query returned no data"**
- Verify data exists in that table for the org/date range
- Check `created_at` timestamps are recent (not in future)
- Test query in psql directly

**"Alert not firing"**
- Verify Slack webhook URL is still valid (refresh if > 30 days old)
- Check alert rule condition matches actual data
- Review alert logs in Grafana (Settings → Alerts → Alert rules → View state)

**"Out of free tier dashboard limit (3)"**
- Archive old dashboards (Settings → Dashboards → Archive)
- Or consolidate into 3 master dashboards with tabs

---

## Next Steps

1. Create Grafana Cloud account (5 min)
2. Configure PostgreSQL data source (5 min)
3. Import the 4 dashboards (SQL queries above) (20 min)
4. Set up Slack notification channel (10 min)
5. Create 4 alert rules (15 min)
6. Test alerts by manually failing a report (2 min)

**Total setup time: ~60 minutes**

Once live, Grafana will stream real-time updates from PostgreSQL every 30 seconds (default refresh rate).
