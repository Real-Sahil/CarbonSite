# API Versioning Policy

MetricOra uses semantic versioning for API stability and backward compatibility. This document outlines the versioning strategy, deprecation timeline, and migration guide.

## Overview

- **Current stable version:** v1.0
- **Development version:** v2.0 (in planning)
- **Versioning scheme:** `major.minor` (e.g., `1.0`, `2.0`)
- **Breaking changes:** Trigger new major version only
- **Deprecation window:** Minimum 6 months notice before sunset

## Version Endpoint

```
GET /api/versioning-policy
```

Returns current versioning policy, supported versions, and response headers.

## API Version Negotiation

### Method 1: URL Path (Primary)
```bash
GET /api/v1/orgs/{orgId}/activity-records
```

### Method 2: Accept-Version Header (Optional)
```bash
curl -H "Accept-Version: 1.0" https://api.metricora.io/api/orgs/{orgId}/activity-records
```

If both are specified, URL path takes precedence.

## Version Status

### Active (v1.0)
- **Status:** Stable
- **Support:** Indefinite until deprecation notice
- **Breaking changes:** None planned
- **Migration:** None required

### Development (v2.0)
- **Status:** Planning phase
- **Expected release:** 2026 Q4
- **Planned changes:** Schema improvements, new fields, better pagination
- **Backward compatibility:** Full compatibility from v1.0 to v2.0 migration path

## Response Headers

Every API response includes version information:

```
HTTP/1.1 200 OK
API-Version: 1.0
X-API-Version: 1.0
```

If a version is deprecated:

```
HTTP/1.1 200 OK
API-Version: 1.0
Deprecation: true
Sunset: 2027-01-01
Deprecated-By: v2.0
Warning: 299 - "API version 1.0 is deprecated"
```

### Header Reference

| Header | Example | Purpose |
|--------|---------|---------|
| `API-Version` | `1.0` | Current API version being used |
| `X-API-Version` | `1.0` | Same as API-Version (redundant for clients) |
| `Deprecation` | `true` | Boolean flag if version is deprecated |
| `Sunset` | `2027-01-01` | ISO 8601 date when version becomes unavailable |
| `Deprecated-By` | `v2.0` | Recommended version to migrate to |
| `Warning` | `299 - "..."` | Standard HTTP warning for deprecated API |

## Deprecation Timeline

### 6-Month Deprecation Window

When a version is marked deprecated:

**Month 1-3:** Early warning period
- Deprecation headers included in responses
- Documentation updated with migration guide
- No service disruption; version remains fully functional

**Month 4-6:** Final warning period
- Increased visibility of deprecation notices
- Client libraries release updates
- Support prioritizes migration assistance

**Month 6+:** Sunset date reached
- Version becomes unavailable
- Clients receive 410 Gone or 404 Not Found
- All traffic redirected or rejected

### Example Timeline

If v1.0 is deprecated on 2027-01-01:
- **2027-01-01:** Deprecation announced, headers added to responses
- **2027-07-01:** Final warning escalation, documentation sprint
- **2027-07-01+:** Sunset takes effect, version unavailable

## Breaking Changes

Breaking changes are changes that require client code modifications:

✅ **NOT breaking:**
- Adding optional fields to responses
- Adding new endpoints
- Adding optional query parameters
- Changing error message text

❌ **Breaking:**
- Removing fields from responses
- Changing response format (JSON structure)
- Changing HTTP status codes
- Renaming required fields

Breaking changes require a new major version (v2.0, v3.0, etc.).

## Migration Guide: v1.0 to v2.0

### Step 1: Check Version
```bash
# Verify your code targets v1.0
curl -H "Accept-Version: 1.0" \
  https://api.metricora.io/api/orgs/{orgId}/activity-records
```

### Step 2: Review Changelog
- Check [CHANGELOG.md](./CHANGELOG.md) for v2.0 differences
- Read migration guide for your specific endpoints
- Update client code for new response formats

### Step 3: Test with v2.0
```bash
# Add test coverage targeting v2.0
curl -H "Accept-Version: 2.0" \
  https://api.metricora.io/api/orgs/{orgId}/activity-records
```

### Step 4: Deploy to Production
```bash
# Update production client configuration
export API_VERSION=2.0  # or update client library version pin
```

### Step 5: Sunset v1.0
- After all clients migrated, v1.0 is retired
- Final sunset date: 6 months after deprecation notice

## Implementation Details

### Version Negotiation Algorithm

1. Check URL path for `/api/v{N}/` pattern
2. If not present, check `Accept-Version` header
3. If neither present, use default version (1.0)
4. Validate requested version is supported
5. Return 406 Not Acceptable if version unsupported

### Adding Version Headers

All API routes use the `addVersionHeaders()` middleware:

```typescript
import { addVersionHeaders, negotiateApiVersion } from "@/lib/api/versioning";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const version = negotiateApiVersion(req);
  
  const data = { /* ... */ };
  let response = NextResponse.json(data);
  
  response = addVersionHeaders(response, version);
  return response;
}
```

### Creating New Versioned Endpoints

Structure API routes by version:

```
app/api/v1/
  orgs/
    [orgId]/
      activity-records/
        route.ts     # GET/POST /api/v1/orgs/{orgId}/activity-records

app/api/v2/
  orgs/
    [orgId]/
      activity-records/
        route.ts     # GET/POST /api/v2/orgs/{orgId}/activity-records
```

**Important:** Keep v1 endpoints unchanged if possible. Duplicate routes if needed for v2 with new logic.

## Support and Questions

- **API Issues:** api-support@metricora.io
- **Documentation:** https://docs.metricora.io/api
- **Status Page:** https://status.metricora.io

## Related Documents

- [API Reference](./REFERENCE.md) — Complete endpoint documentation
- [CHANGELOG](./CHANGELOG.md) — Version-by-version changes
- [Rate Limiting](./RATE_LIMITING.md) — Rate limit policies
- [Authentication](./AUTHENTICATION.md) — Auth flow documentation
