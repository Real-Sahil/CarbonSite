# Observability & Monitoring

CarbonSite uses OpenTelemetry and Grafana Cloud for distributed tracing, metrics, and logging.

## Environment Configuration

### Grafana Cloud Setup

1. Sign up at https://grafana.com/signup/cloud/connect-data/
2. Create a new stack (or use existing)
3. Navigate to "Details" → "OpenTelemetry" section
4. Copy your:
   - **API Key** (username:password format or standalone)
   - **OTLP HTTP Endpoint** for traces
   - **Prometheus Remote Write URL** for metrics

### Environment Variables

```bash
# Enable observability (only active in production)
NODE_ENV=production

# Grafana Cloud authentication
GRAFANA_CLOUD_API_KEY=your-api-key-or-username:password
GRAFANA_CLOUD_TRACES_URL=https://tempo-blocks-prod-us-central-0.grafana-blocks.grafana.cloud/otlp/v1/traces
GRAFANA_CLOUD_METRICS_URL=https://prometheus-blocks-prod-us-central-0.grafana-blocks.grafana.cloud/otlp/v1/metrics

# Optional: App metadata
VERCEL_ENV=production  # Set by Vercel automatically
```

## Metrics Tracked

### API Requests
- **api.requests** — Total request count by method, path, status
- **api.errors** — Error count by method, path, status
- **api.request.duration** — Request latency histogram

### Jobs
- **jobs.processed** — Total jobs processed by queue
- **jobs.failed** — Failed job count by queue
- **job.processing.duration** — Job processing time histogram
- **jobs.active** — Current active job count
- **jobs.queued** — Current queued job count

### Authentication
- **auth.success** — Successful auth attempts by method
- **auth.failure** — Failed auth attempts by method

### Database
- **database.query.duration** — Query latency histogram by query type

## Health Check

The `/api/health` endpoint returns service status:

```bash
curl https://yourdomain.com/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-08-25T10:00:00Z",
  "checks": {
    "database": "ok",
    "uptime": 3600
  }
}
```

## Logs

Structured logs are output as JSON:

```json
{
  "level": "INFO",
  "module": "auth",
  "message": "User signed in",
  "userId": "user123",
  "timestamp": "2026-08-25T10:00:00Z"
}
```

Logs include:
- Log level (INFO, ERROR, WARN, DEBUG)
- Module/service name
- Message and structured metadata
- Error stack traces (for ERROR level)

## Dashboards

### Key Metrics to Monitor

1. **API Health**
   - Request rate (req/s)
   - Error rate (%)
   - P95 latency (ms)
   - Status code distribution

2. **Job Processing**
   - Job throughput by queue
   - Failure rate by queue
   - Processing time by queue
   - Queue depth (active + queued)

3. **Database**
   - Query latency by type
   - Query count
   - Connection pool status
   - Slow query detection

4. **Application**
   - Uptime
   - Authentication success/failure rate
   - Service dependencies status

## Grafana Cloud Setup Steps

1. Log into Grafana Cloud dashboard
2. Go to **Data Sources** → **Add Data Source**
3. Select **Prometheus** and configure:
   - URL: Your Prometheus Remote Write URL
   - Auth: Basic auth with API Key
4. Create dashboards for key metrics above
5. Set up alerts for:
   - Error rate > 5%
   - API p95 latency > 2s
   - Database query time > 500ms
   - Service health check failures

## Development

In development (NODE_ENV !== 'production'), observability is disabled. 
Logs are written to stdout as JSON for local debugging.

Enable debug logging:
```bash
DEBUG=1 pnpm dev
```

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Grafana Cloud Docs](https://grafana.com/docs/grafana-cloud/)
- [OTLP Protocol](https://opentelemetry.io/docs/specs/otlp/)
