# Grafana Cloud Monitoring Setup

This guide sets up real-time monitoring for CarbonSite using Grafana Cloud's free tier.

## Prerequisites

- Grafana Cloud account (free tier: 3 users, 3 dashboards) at https://grafana.com/auth/sign-up/create-user
- PostgreSQL connection details (DATABASE_URL)
- Access to admin settings

## Step 1: Create Grafana Cloud Account

1. Go to https://grafana.com/auth/sign-up/create-user
2. Sign up with your email
3. Create organization name (e.g., "CarbonSite")
4. Note your organization ID and API token (Settings → API Keys)

## Step 2: Add PostgreSQL Data Source

1. In Grafana Cloud, go to **Connections** → **Data sources**
2. Click **Add new data source**
3. Search for **PostgreSQL** and select it
4. Configure with these settings:

```
Host: [your-neon-host].neon.tech
Port: 5432
Database: carbonsite
User: [postgres-user]
Password: [postgres-password]
SSL Mode: require
```

5. Click **Save & test** to verify connection

## Step 3: Import Pre-built Dashboards

### Dashboard 1: Report Generation Pipeline

1. Go to **Dashboards** → **Import**
2. Copy the JSON from `grafana/dashboards/report-pipeline.json`
3. Paste into the import dialog
4. Select PostgreSQL as data source
5. Click **Import**

This dashboard shows:
- Reports by status (queued, generating, ready, failed)
- Average generation time
- Failed reports last 24h
- Report generation timeline

### Dashboard 2: Data Quality Metrics

1. Repeat import process with `grafana/dashboards/data-quality.json`

This dashboard shows:
- Overall quality score trend
- Dimension scores (completeness, accuracy, consistency, timeliness, validity)
- Common validation issues
- Quality score distribution

### Dashboard 3: Field Submission Status

1. Repeat import process with `grafana/dashboards/field-submissions.json`

This dashboard shows:
- Submissions by status
- Submission timeline
- Average review time
- Reviewer performance

## Step 4: Set Up Alerts

### Alert Rule 1: Failed Reports

Alert condition: `failed_count > 3` in last 24 hours

### Alert Rule 2: Low Data Quality

Alert condition: `avg_quality < 70` over last 7 days

### Alert Rule 3: Slow Report Generation

Alert condition: `avg_seconds > 300` (5 minutes) over last 7 days

## Step 5: Configure Slack/Email Notifications

### Slack Integration

1. In Grafana, go to **Alerting** → **Contact points**
2. Click **New contact point**
3. Name: "Slack"
4. Contact type: Slack
5. Webhook URL: [Get from Slack workspace settings](https://slack.com/apps)
6. Click **Test** to verify

### Email Integration

1. Create new contact point
2. Name: "Email"
3. Contact type: Email
4. Email address: your-email@company.com

## Cost Notes

**Free tier includes:**
- 3 users
- 3 dashboards
- 10GB/month data
- Basic alerting

For CarbonSite MVP, free tier is sufficient.
