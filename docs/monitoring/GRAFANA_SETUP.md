# Phase 1D: Real-Time Monitoring via Grafana Cloud

This document provides setup instructions for Grafana Cloud monitoring of CarbonSite emissions data processing pipelines.

## Overview

Grafana Cloud provides real-time dashboards for monitoring:
- Report generation pipeline status (queued → generating → ready)
- Data quality check results (pass/fail rates)
- Import batch processing metrics
- Field submission approval workflows
- Presigned URL and evidence access patterns

**Cost:** Free tier (3 users, 3 dashboards, 50GB logs/month)

## Setup Steps

### 1. Create Grafana Cloud Account

1. Visit [grafana.com](https://grafana.com)
2. Click "Sign Up" and create free account
3. Select "Grafana Cloud" (free tier)
4. Create organization (e.g., "CarbonSite")

### 2. Add PostgreSQL Data Source

#### In Grafana:
1. Navigate to **Connections → Data Sources**
2. Click **Add new data source**
3. Select **PostgreSQL**
4. Configure:
   - **Name:** `CarbonSite PostgreSQL`
   - **Host:** Your Neon or PostgreSQL hostname
   - **Database:** `carbonsite`
   - **User:** Database user (usually `neondb_owner`)
   - **Password:** Database password
   - **SSL Mode:** `require` (for Neon)
   - **TLS/SSL Mode:** Select appropriate option for your database

5. Click **Save & Test** (should show "Database connection OK")

### 3. Import Report Pipeline Dashboard

Create new dashboard:

1. Click **+** → **New Dashboard**
2. Add panel (Add a panel)
3. Use this SQL query:

```sql
SELECT
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as percentage,
  MAX(created_at) as last_activity
FROM reports
WHERE organization_id = $__variable_string(orgId)
AND created_at > NOW() - INTERVAL '30 days'
GROUP BY status
ORDER BY count DESC
```

4. Visualization: **Pie Chart** or **Stat**
5. Configure thresholds:
   - Green (✓): `ready`, `success`
   - Yellow (⚠): `generating`, `processing`
   - Red (✗): `failed`

### 4. Create Data Quality Dashboard

Add another panel for quality scores:

```sql
SELECT
  DATE_TRUNC('day', b.created_at) as date,
  ROUND(AVG(q.overall_score), 1) as avg_quality_score,
  COUNT(CASE WHEN q.can_commit = true THEN 1 END) as batches_passed,
  COUNT(*) as total_batches
FROM import_batches b
LEFT JOIN import_batch_quality_scores q ON b.id = q.import_batch_id
WHERE b.organization_id = $__variable_string(orgId)
AND b.created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', b.created_at)
ORDER BY date DESC
```

Visualization: **Graph** or **Time Series**

### 5. Create Field Submissions Tracker

```sql
SELECT
  status,
  COUNT(*) as count
FROM field_submissions
WHERE organization_id = $__variable_string(orgId)
AND created_at > NOW() - INTERVAL '7 days'
GROUP BY status
```

Visualization: **Stat** (show count per status)

### 6. Set Up Alerts

1. Go to **Alerts & IRM → Alerting Policies**
2. Create alert: "High Report Failure Rate"
   - **Condition:** `failed_reports_24h > 5`
   - **Notification:** Slack webhook (requires Slack integration)
3. Repeat for "Import Quality Below Threshold"

### 7. Connect Slack Integration (Optional)

1. In Grafana: **Administration → Integrations → Slack**
2. Follow setup wizard to create Slack app
3. Add webhook URL to Grafana alerting policies
4. Test with sample alert

## Dashboard Queries

### Reports Processing Pipeline

```sql
SELECT
  'Queued' as status,
  COUNT(*) as value
FROM reports
WHERE status = 'queued'
AND organization_id = $__variable_string(orgId)
UNION ALL
SELECT 'Generating', COUNT(*)
FROM reports
WHERE status = 'generating'
AND organization_id = $__variable_string(orgId)
UNION ALL
SELECT 'Ready', COUNT(*)
FROM reports
WHERE status = 'ready'
AND organization_id = $__variable_string(orgId)
UNION ALL
SELECT 'Failed', COUNT(*)
FROM reports
WHERE status = 'failed'
AND organization_id = $__variable_string(orgId)
```

### Average Report Generation Time

```sql
SELECT
  ROUND(AVG(EXTRACT(epoch FROM (published_at - created_at))) / 60, 1) as avg_minutes
FROM reports
WHERE organization_id = $__variable_string(orgId)
AND published_at IS NOT NULL
AND created_at > NOW() - INTERVAL '30 days'
```

### Data Quality Trends

```sql
SELECT
  DATE_TRUNC('day', created_at) as date,
  COUNT(CASE WHEN passed = true THEN 1 END) as passed,
  COUNT(CASE WHEN passed = false THEN 1 END) as failed,
  ROUND(100.0 * COUNT(CASE WHEN passed = true THEN 1 END) / COUNT(*), 1) as pass_rate
FROM data_quality_checks
WHERE organization_id = $__variable_string(orgId)
GROUP BY date
ORDER BY date DESC
```

## Variable Configuration

### Add Organization ID Variable

1. Go to dashboard **Settings → Variables**
2. Click **Add Variable**
3. Configure:
   - **Name:** `orgId`
   - **Type:** `Query`
   - **Data source:** CarbonSite PostgreSQL
   - **Query:**
   ```sql
   SELECT DISTINCT id FROM organizations
   ```
4. Save

## Maintenance

### Daily Checks
- Monitor "Failed Reports" stat (should be < 5 per day)
- Check "Data Quality Average" (should be > 80%)
- Verify "Average Field Submission Approval Time" (< 2 hours)

### Weekly Review
1. Check for trends in report generation time
2. Review quality score distribution
3. Verify no alerts triggered unexpectedly

### Monthly Actions
1. Review alert thresholds (adjust based on organization size)
2. Clean up old dashboards or panels
3. Review Slack notification logs for actionable issues

## Troubleshooting

### Database Connection Fails
- Verify PostgreSQL credentials in Grafana
- Check SSL/TLS certificate validity
- Ensure database firewall allows Grafana Cloud IPs
- For Neon: use `sslmode=require` in connection string

### No Data in Queries
- Verify `organization_id` variable is set correctly
- Check date ranges (use `NOW() - INTERVAL '...'`)
- Run query directly in database client to debug
- Verify tables exist: `SELECT * FROM information_schema.tables WHERE table_schema = 'public'`

### Alerts Not Firing
- Test alert with manual threshold adjustment
- Check Slack integration connectivity
- Verify alert query returns numeric values
- Review Grafana logs for evaluation errors

## Best Practices

1. **Organization Scoping:** Always filter by `organization_id` in queries for multi-tenant correctness
2. **Time Ranges:** Use `NOW() - INTERVAL '...'` instead of hard-coded dates
3. **Performance:** Add indexes on `organization_id, created_at` for large tables
4. **Alerts:** Set realistic thresholds (avoid alert fatigue)
5. **Backup:** Export dashboards monthly (Settings → Export)

## Cost Optimization

- Free tier: 3 dashboards, 50GB logs/month
- Recommended: 2-3 dashboards total (avoid duplicate panels)
- Archive old dashboards when no longer needed
- Use Loki for logs if log volume exceeds limits

## Related Documentation

- [Grafana Dashboard Queries](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/manage-dashboards/)
- [PostgreSQL Data Source](https://grafana.com/docs/grafana/latest/datasources/postgres/)
- [Alert Rules](https://grafana.com/docs/grafana/latest/alerting/alerting-rules/)
- [CarbonSite Database Schema](../README.md)
