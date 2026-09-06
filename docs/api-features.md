# MetricOra API Features

## Production Hardening & Analytics (PR #17)

### Rate Limiting & Validation
- **Rate Limiting**: Per-IP and per-org request throttling (configurable)
  - Returns 429 status with `Retry-After` header
  - Exponential backoff support
  - Automatic cleanup of expired entries

- **File Validation**: Comprehensive upload security
  - MIME type validation with presets (CSV, Excel, images, PDFs)
  - File size limits (25MB CSV, 25MB Excel, 10MB images, 20MB PDFs)
  - File name sanitization to prevent directory traversal
  - Support for multi-file uploads

- **Request Validation**: Zod-based schema validation
  - Detailed field-level error responses
  - Type-safe query parameter parsing
  - Automatic JSON body validation

### Data Exports
- **GET** `/api/orgs/{orgId}/export/excel`
  - Export types: `full`, `records-only`, `summary`
  - Multi-sheet workbooks with professional formatting
  - SHA256 checksums for data integrity
  - Query params: `periodId` (optional), `type` (default: "full")
  - Returns formatted Excel file with frozen headers and auto-width columns

### Operations & Monitoring

#### Failed Job Management
- **GET** `/api/orgs/{orgId}/jobs`
  - List all failed jobs with retry status
  - Filter by status (failed, retrying, abandoned)
  - Filter by job type (import, calculation, report, notification, xero-sync)
  - Returns: jobs array + statistics by status and type
  - Authorization: admin only

#### Alerts Management
- **GET** `/api/orgs/{orgId}/alerts`
  - View SBTi deviations, benchmark comparisons, compliance alerts
  - Filter by severity (critical, warning, info)
  - Filter by type (sbti, benchmark, compliance, all)
  - Filter by resolution status (resolved/unresolved)
  - Returns: alerts array + summary counts
  - Authorization: sustainability role

- **POST** `/api/orgs/{orgId}/alerts/acknowledge`
  - Mark alerts as resolved
  - Batch acknowledge multiple alerts
  - Authorization: sustainability role

### Data Quality & Analytics

#### Data Quality Scoring
- **GET** `/api/orgs/{orgId}/data-quality`
  - Comprehensive quality metrics (0-100 score)
  - Breakdown: completeness, accuracy, timeliness, consistency
  - Issue identification with recommendations
  - Optional trend data (6-month history)
  - Optional high-risk record identification (top 10)
  - Query params: `periodId`, `includeTrend`, `includeRiskRecords`
  - Authorization: sustainability role

#### Automated Calculation Scheduling
- **GET** `/api/orgs/{orgId}/calculation-schedules`
  - List all calculation schedules
  - Returns schedule details + statistics
  - Authorization: editor+

- **POST** `/api/orgs/{orgId}/calculation-schedules`
  - Create new schedule (weekly, monthly, quarterly, annually)
  - Configure execution times (day of week, day of month)
  - Request body: name, description, schedule, timing parameters
  - Authorization: admin only

#### Anomaly Detection
- **GET** `/api/orgs/{orgId}/analytics/anomalies`
  - Detect statistical outliers (Z-score > 2)
  - Identify trend changes (linear regression)
  - Detect unusual patterns (Scope distribution)
  - Query params: `type` (outliers, trends, patterns, full), `periodId`
  - Returns: anomalies with severity, deviation, recommendations
  - Authorization: sustainability role

### Xero Integration
- **Complete Sync Implementation**: Invoice-to-activity-record mapping
  - Automatic category detection from line item descriptions
  - Support for: fuel/transport, supplies, utilities/energy categories
  - Deduplication by external ID to prevent duplicate processing
  - Spend-based emissions calculation from invoice amounts
  - Idempotent sync operations

## Error Handling

All endpoints return standardized error responses:
```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable message",
  "details": { /* optional context */ }
}
```

HTTP Status Codes:
- `200 OK` - Successful GET
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Missing authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limited
- `500 Internal Server Error` - Server error

## Rate Limiting

Default limits:
- Global: 100 requests per minute per IP
- Per-org: Configurable (default 500 requests per minute)
- Retry-After header indicates seconds until next request allowed

## Authentication

All org-scoped endpoints require:
1. Valid session cookie (web) or JWT token (mobile)
2. Organization membership verification
3. Role-based authorization (admin, editor, reviewer, viewer, auditor, field_worker)

## Pagination

List endpoints support cursor-based pagination:
- Query params: `cursor`, `limit` (default: 25, max: 100)
- Response includes `nextCursor` for pagination

## Filtering & Search

Common query parameters:
- `periodId` - Filter by reporting period
- `status` - Filter by status (varies by resource)
- `severity` - Filter by severity (critical, warning, info)
- `type` - Filter by resource type
- `resolved` - Filter by resolution status
