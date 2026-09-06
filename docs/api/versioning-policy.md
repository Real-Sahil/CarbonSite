# API Versioning Policy

MetricOra uses semantic versioning for API endpoints to ensure backward compatibility and predictable deprecation timelines.

## Current Versions

| Version | Status | Released | Sunset |
|---------|--------|----------|--------|
| 1.0 | Stable | 2024-06-01 | 2025-02-01 (estimated) |
| 2.0 | Planned | TBD | TBD |

## Using Versioned Endpoints

### Default Version

If no `Accept-Version` header is provided, requests default to the current stable version (1.0).

```bash
curl https://api.metricora.io/api/orgs/org-123/activity-records
# Uses version 1.0 by default
```

### Requesting a Specific Version

Use the `Accept-Version` header to request a specific API version:

```bash
curl -H "Accept-Version: 1.0" https://api.metricora.io/api/orgs/org-123/activity-records
```

## Deprecation Policy

1. **Announcement Phase** (6 months before sunset)
   - Deprecated endpoints return `Deprecation: true` header
   - Emails sent to org admins with migration timeline

2. **Grace Period** (3 months)
   - Old version continues to function
   - New clients encouraged to migrate

3. **Sunset** (on scheduled date)
   - Old version endpoint returns 410 Gone

## Response Headers

| Header | Description |
|--------|-------------|
| `API-Version` | Version number (e.g., "1.0") |
| `Deprecation` | "true" if version is deprecated |
| `Sunset` | RFC 7231 date when version will be removed |

## Backward Compatibility Guarantees

Version 1.0 guarantees:
- All documented endpoints remain available
- Response fields are additive only
- Documented error codes unchanged
- Authentication requirements unchanged
