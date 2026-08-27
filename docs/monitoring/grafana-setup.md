# Grafana Cloud Setup Guide

Real-time operational monitoring dashboard for CarbonSite using Grafana Cloud.

## Overview

Grafana Cloud provides free-tier monitoring with:
- 3 users
- 3 dashboards
- PostgreSQL data source integration
- No additional infrastructure needed

**Sign up:** https://grafana.com/auth/sign-up/create-account

## Database Configuration

### Step 1: Get PostgreSQL Connection Details

```bash
# Retrieve your production database URL (from Neon or your provider)
echo $DATABASE_URL
# Example: postgres://user:password@host:5432/carbonsite
```

### Step 2: Add PostgreSQL Data Source in Grafana

1. Navigate to **Configuration** → **Data Sources**
2. Click **Add Data Source**
3. Select **PostgreSQL**
4. Configure:
   - **Name:** CarbonSite PostgreSQL
   - **Host:** your-database-host.neon.tech
   - **Database:** carbonsite
   - **User:** postgres username
   - **Password:** postgres password
   - **Port:** 5432
   - **SSL Mode:** require (if using Neon)
5. Click **Save & Test**

## Dashboard 1: Report Generation Pipeline

Monitor the entire report lifecycle from creation to delivery.

### Panels:

#### 1. Reports by Status (Gauge)
```sql
SELECT 
  COUNT(*) as count,
  status
FROM reports
WHERE organization_id = '${orgId}'
GROUP BY status
```

Status breakdown:
- 🟢 `queued` (pending processing)
- 🟡 `generating` (in progress)
- 🔵 `ready` (completed successfully)
- 🔴 `failed` (encountered error)

#### 2. Average Generation Time (Stat)
```sql
SELECT 
  AVG(EXTRACT(epoch FROM (published_at - created_at))) as avg_seconds,
  ROUND(AVG(EXTRACT(epoch FROM (published_at - created_at))) / 60::numeric, 2) as avg_minutes
FROM reports
WHERE organization_id = '${orgId}'
  AND status = 'ready'
  AND published_at >= NOW() - INTERVAL '30 days'
```

Target: < 5 minutes average

#### 3. Failed Reports (Last 24h)
```sql
SELECT COUNT(*) as failed_reports
FROM reports
WHERE organization_id = '${orgId}'
  AND status = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours'
```

Alert: Trigger if > 5 failures in 24h

#### 4. Generation Time Trend (Graph)
```sql
SELECT 
  DATE_TRUNC('hour', published_at) as time,
  AVG(EXTRACT(epoch FROM (published_at - created_at))) as avg_seconds
FROM reports
WHERE organization_id = '${orgId}'
  AND status = 'ready'
  AND published_at >= NOW() - INTERVAL '7 days'
GROUP BY 1
ORDER BY 1 DESC
```

#### 5. Reports per Organization (Table)
```sql
SELECT 
  o.name as organization,
  COUNT(r.id) as total_reports,
  SUM(CASE WHEN r.status = 'ready' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END) as failed,
  ROUND(100.0 * SUM(CASE WHEN r.status = 'ready' THEN 1 ELSE 0 END) / COUNT(r.id), 1) as success_rate
FROM reports r
JOIN organizations o ON r.organization_id = o.id
WHERE r.created_at >= NOW() - INTERVAL '7 days'
GROUP BY o.id, o.name
ORDER BY total_reports DESC
```

## Dashboard 2: Data Quality & Validation

Monitor import data quality and validation pipeline health.

### Panels:

#### 1. Average Quality Score (Gauge)
```sql
SELECT 
  ROUND(AVG(quality_score), 1) as avg_score
FROM data_quality_checks
WHERE created_at >= NOW() - INTERVAL '30 days'
```

Target: > 85%

#### 2. Quality Score Distribution (Histogram)
```sql
SELECT 
  quality_score,
  COUNT(*) as frequency
FROM data_quality_checks
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY quality_score
ORDER BY quality_score
```

#### 3. Failed Checks by Type (Bar Chart)
```sql
SELECT 
  check_type,
  SUM(CASE WHEN passed = false THEN 1 ELSE 0 END) as failed_count
FROM data_quality_checks
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY check_type
ORDER BY failed_count DESC
```

Check types:
- `weight_range` — normalized amount within valid bounds
- `unit_validity` — recognized emission units
- `date_range` — dates within reporting period
- `completeness` — required fields not null
- `freshness` — data < 1 year old
- `volume` — minimum rows imported

#### 4. Imports by Quality Tier (Pie Chart)
```sql
SELECT 
  CASE 
    WHEN quality_score >= 90 THEN 'Excellent (≥90%)'
    WHEN quality_score >= 80 THEN 'Good (80-89%)'
    WHEN quality_score >= 70 THEN 'Fair (70-79%)'
    ELSE 'Poor (<70%)'
  END as tier,
  COUNT(*) as count
FROM data_quality_checks
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY tier
```

#### 5. Detailed Check Results (Table)
```sql
SELECT 
  ib.id as batch_id,
  o.name as organization,
  dqc.check_name,
  dqc.quality_score,
  dqc.failures_count,
  dqc.created_at
FROM data_quality_checks dqc
JOIN import_batches ib ON dqc.import_batch_id = ib.id
JOIN organizations o ON dqc.organization_id = o.id
WHERE dqc.created_at >= NOW() - INTERVAL '7 days'
ORDER BY dqc.created_at DESC
LIMIT 100
```

## Dashboard 3: Field Submissions Pipeline

Monitor field worker submissions and approval workflow.

### Panels:

#### 1. Submissions by Status (Gauge)
```sql
SELECT 
  status,
  COUNT(*) as count
FROM field_submissions
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY status
ORDER BY count DESC
```

Status breakdown:
- 🟡 `pending` (awaiting review)
- 🟢 `approved` (accepted)
- 🔴 `rejected` (needs correction)

#### 2. Approval Rate (Stat)
```sql
SELECT 
  ROUND(
    100.0 * SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) / 
    NULLIF(COUNT(*), 0),
    1
  ) as approval_rate_percent
FROM field_submissions
WHERE created_at >= NOW() - INTERVAL '30 days'
```

Target: > 95%

#### 3. Average Review Time (Stat)
```sql
SELECT 
  ROUND(
    AVG(
      EXTRACT(epoch FROM (reviewed_at - created_at)) / 3600::numeric
    ),
    1
  ) as avg_hours
FROM field_submissions
WHERE status IN ('approved', 'rejected')
  AND reviewed_at IS NOT NULL
  AND created_at >= NOW() - INTERVAL '30 days'
```

#### 4. Submissions per Day (Graph)
```sql
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as submissions,
  SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
  SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
FROM field_submissions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 DESC
```

#### 5. Reviewer Workload (Table)
```sql
SELECT 
  u.name as reviewer,
  COUNT(fs.id) as submissions_reviewed,
  SUM(CASE WHEN fs.status = 'approved' THEN 1 ELSE 0 END) as approved,
  SUM(CASE WHEN fs.status = 'rejected' THEN 1 ELSE 0 END) as rejected,
  ROUND(
    100.0 * SUM(CASE WHEN fs.status = 'approved' THEN 1 ELSE 0 END) / 
    NULLIF(COUNT(fs.id), 0),
    1
  ) as approval_rate
FROM field_submissions fs
JOIN users u ON fs.reviewed_by_id = u.id
WHERE fs.reviewed_at >= NOW() - INTERVAL '7 days'
GROUP BY u.id, u.name
ORDER BY submissions_reviewed DESC
```

## Setting Up Alerts

### Alert 1: High Report Failure Rate
Trigger when > 5 reports fail in 24 hours:

```
Query: SELECT COUNT(*) FROM reports WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours'
Condition: is above 5
Action: Send to Slack channel #alerts
```

### Alert 2: Data Quality Below Threshold
Trigger when average quality score < 80%:

```
Query: SELECT AVG(quality_score) FROM data_quality_checks WHERE created_at >= NOW() - INTERVAL '1 hour'
Condition: is below 80
Action: Send to Slack channel #data-quality
```

### Alert 3: Submission Review Backlog
Trigger when > 20 submissions pending:

```
Query: SELECT COUNT(*) FROM field_submissions WHERE status = 'pending' AND created_at >= NOW() - INTERVAL '24 hours'
Condition: is above 20
Action: Send to Slack channel #field-ops
```

## Environment Variables for Production

Add to your `.env.production`:

```bash
# Grafana Cloud (optional, for API access)
GRAFANA_API_URL=https://grafana.com/api
GRAFANA_API_KEY=eyJ...  # Generated in Grafana org settings
```

## Verification Checklist

- [ ] Grafana Cloud account created and free tier activated
- [ ] PostgreSQL data source added and tested
- [ ] Dashboard 1: Report Generation Pipeline created with 5 panels
- [ ] Dashboard 2: Data Quality & Validation created with 5 panels
- [ ] Dashboard 3: Field Submissions Pipeline created with 5 panels
- [ ] Alerts configured and Slack integration tested
- [ ] Team members given access to dashboards (Viewer role)
- [ ] Dashboard links added to `/docs/monitoring/` README

## Accessing the Dashboards

1. Log into https://grafana.com
2. Navigate to **Dashboards** in the sidebar
3. Search for:
   - "Report Generation Pipeline"
   - "Data Quality & Validation"
   - "Field Submissions Pipeline"

## Cost Breakdown (Production)

| Component | Free Tier | Cost |
|---|---|---|
| Grafana Cloud | 3 users, 3 dashboards | $0 |
| PostgreSQL queries | Unlimited read | $0 |
| Slack alerts | Unlimited | $0 |
| **Total Monthly** | **—** | **$0** |

## Next Steps

1. Set up Grafana Cloud account
2. Add PostgreSQL data source
3. Create the 3 dashboards using the SQL queries above
4. Configure Slack alerts
5. Share dashboard links with team
6. Review dashboards weekly during operations meetings

---

**Created:** 2026-08-27
**Last Updated:** 2026-08-27
**Status:** Ready for production setup
