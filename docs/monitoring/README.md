# MetricOra Monitoring & Real-Time Dashboards

This directory contains monitoring setup and operational guides for MetricOra.

## Overview

MetricOra includes comprehensive monitoring at three levels:

1. **Database-Level Audit Logging (Phase 1A)** → PostgreSQL audit trail via pgAudit
2. **Data Quality Monitoring (Phase 1B)** → Import quality scores and issue tracking
3. **Interactive Dashboards (Phase 1C)** → Recharts components in web app
4. **Real-Time Operations (Phase 1D)** → Grafana Cloud dashboards

## Contents

- **GRAFANA_SETUP.md** — Complete Grafana Cloud configuration guide
- **DATABASE_QUERIES.md** — SQL queries for custom dashboards
- **ALERTS.md** — Alert rules and notification setup

## Quick Start

### For Operators
1. Read [GRAFANA_SETUP.md](./GRAFANA_SETUP.md)
2. Create free Grafana Cloud account
3. Connect PostgreSQL data source
4. Import dashboard templates

### For Developers
1. View [Phase 1A pgAudit](../Phase1A_AuditLogging.md) for audit log structure
2. Check [Phase 1B Data Quality](../Phase1B_DataQuality.md) for quality check schema
3. See [Phase 1C Charts](../Phase1C_Interactive Charting.md) for frontend components

## Monitoring Checklist

- [ ] pgAudit extension enabled in PostgreSQL
- [ ] DataQualityCheck and ImportBatchQualityScore tables created
- [ ] Recharts EmissionsTrendChart component deployed
- [ ] Grafana Cloud account created and PostgreSQL connected
- [ ] Report pipeline dashboard created
- [ ] Data quality dashboard created
- [ ] Alerts configured for failed reports (> 5 per day)
- [ ] Slack integration tested
- [ ] Team notified of dashboard URLs

## SLA Targets

- Report generation: < 5 minutes (p95)
- Data quality average: > 80%
- Failed imports: < 5 per day
- Presigned URL errors: < 1% of requests
- Field submission approval: < 2 hours (p95)

## Support

For issues with:
- **pgAudit:** See `lib/db/audit.ts` and `app/api/orgs/[orgId]/audit-logs`
- **Data Quality:** See `lib/validation/data-quality.ts`
- **Charts:** See `components/dashboard/EmissionsTrendChart.tsx`
- **Grafana:** See GRAFANA_SETUP.md troubleshooting section
