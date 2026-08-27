# CarbonSite API Versioning Policy

## Overview

CarbonSite uses semantic versioning for its API to provide backward compatibility while allowing for breaking changes. This document describes the versioning strategy, deprecation timeline, and migration guidance.

## Version Format

API versions follow `MAJOR.MINOR` format:
- **MAJOR**: Breaking changes (e.g., 1.0 → 2.0)
- **MINOR**: Non-breaking features or fixes (e.g., 1.0 → 1.1)

## Accessing Versioned APIs

### Default Behavior
If no version is specified, requests use the current stable API version (v1.0):

```bash
curl https://api.carbonsite.app/api/orgs/org123/records
# Equivalent to: Accept-Version: 1.0
```

### Explicit Version
Specify the API version using the `Accept-Version` header:

```bash
curl https://api.carbonsite.app/api/orgs/org123/records \
  -H "Accept-Version: 1.0"

# Or for newer versions:
curl https://api.carbonsite.app/api/orgs/org123/records \
  -H "Accept-Version: 2.0"
```

## Backward Compatibility Window

- **Current version**: Full support
- **Previous major version**: 6 months of support (if applicable)
- **Older versions**: Deprecated; sunset after 6-month notice period

Example timeline:
- 2024-08-01: v2.0 released; v1.0 enters deprecation phase
- 2025-02-01: v1.0 sunset date; requests to v1.0 will fail with 410 Gone
- 2025-02-02: v1.0 routes removed entirely

## Deprecation Notices

### HTTP Headers
When a version is deprecated, responses include:

```
Deprecation: true
Sunset: 2025-02-01T00:00:00Z
Warning: 299 - "API v1.0 will sunset on 2025-02-01. Migrate to v2.0."
API-Version: 1.0
```

### Response Status Codes
- **200-299**: Success (deprecated version still working)
- **406 Not Acceptable**: Unsupported API version requested
- **410 Gone**: Version has passed sunset date

## What Changes Between Versions

### Breaking Changes (Require Major Version Bump)
- Removing fields from responses
- Changing field types (e.g., `string` → `number`)
- Changing HTTP status codes for specific scenarios
- Renaming endpoints or parameters
- Changing required fields to optional (or vice versa, in request bodies)

### Non-Breaking Changes (Backward Compatible)
- Adding new optional fields to responses
- Adding new optional query parameters
- Adding new endpoints
- Deprecating fields (without removing them)
- Expanding accepted field values

## Migration Guide

### v1.0 → v2.0

**Coming soon.** v2.0 is in development. Major changes planned:

- [ ] New `/api/v2/reports` endpoint with streaming support
- [ ] Pagination cursor format change (no backward compatibility)
- [ ] Removal of deprecated `/api/v1/legacy/*` routes

## Version-Specific Behavior

### v1.0 (Current)
- Released: 2024-07-01
- Status: **Stable**
- Support Until: 2025-02-01 (estimated)
- Pagination: Offset-based (`offset`, `limit`)
- Authentication: Bearer token in `Authorization` header
- Rate Limits: 100 requests/min per org

### v2.0 (Future)
- Planned Release: Q4 2024
- Status: **In Development**
- Planned Features:
  - Cursor-based pagination
  - WebSocket support for real-time updates
  - Enhanced filtering and sorting
  - Batch operations endpoint

## Checking Supported Versions

### List Supported Versions
```bash
curl https://api.carbonsite.app/api/_meta/versions

# Response:
{
  "versions": ["1.0", "2.0"],
  "current": "1.0",
  "latest": "2.0"
}
```

### Check Version Status
```bash
curl https://api.carbonsite.app/api/_meta/versions/1.0

# Response (if deprecated):
{
  "version": "1.0",
  "deprecated": true,
  "sunsetDate": "2025-02-01T00:00:00Z",
  "supportedUntil": "2025-02-01",
  "notice": "Migrate to API v2.0"
}
```

## Best Practices

1. **Always specify Accept-Version**: Don't rely on defaults; explicitly request the version your client expects
2. **Monitor deprecation headers**: Parse the `Deprecation` and `Sunset` headers to alert users
3. **Plan migration ahead**: Don't wait until sunset date to migrate
4. **Test regularly**: Verify against the latest supported version
5. **Handle version errors gracefully**: Implement fallback logic if a version request fails

## Support and Questions

- **API Documentation**: https://api.carbonsite.app/docs
- **API Status**: https://status.carbonsite.app
- **Support Email**: support@carbonsite.app
- **Slack Community**: [Join our Slack](https://carbonsite.slack.com)

## Changelog

### 2024-08-27
- API v1.0 released
- Versioning policy documented
- Accept-Version header support added
