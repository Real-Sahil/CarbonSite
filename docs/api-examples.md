# API Examples: Complete Workflow

Practical examples for interacting with MetricOra API using cURL and JavaScript.

## Authentication

### Sign Up (Web)

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@company.com",
    "password": "secure-password-123"
  }'

# Response:
# {
#   "user": { "id": "user-123", "email": "user@company.com" },
#   "session": { "id": "session-456" }
# }
```

### Sign In (Web)

```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@company.com",
    "password": "secure-password-123"
  }' \
  -c cookies.txt  # Save session cookie

# Response: Same as signup with session cookie set
```

### Get Mobile Access Token (Flutter App)

```bash
# First sign in on web to get session cookie
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"user@company.com","password":"password"}' \
  -c cookies.txt

# Then get JWT token for mobile
curl -X POST http://localhost:3000/api/auth/token \
  -H "Cookie: $(cat cookies.txt | grep -oP 'sessionToken=\K[^;]*')"

# Response:
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "expiresIn": 3600
# }
```

## Organization Management

### Create Organization (Platform Admin Only)

```bash
# Platform admins create orgs via the platform API.
curl -X POST http://localhost:3000/api/platform/orgs \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Acme Construction",
    "industry": "construction",
    "country": "US",
    "employeeCount": 150
  }'

# Response:
# {
#   "id": "org-abc123",
#   "name": "Acme Construction",
#   "createdAt": "2025-08-24T10:30:00Z"
# }
```

### List Organizations for Current User

```bash
curl -X GET http://localhost:3000/api/orgs \
  -b cookies.txt

# Response:
# {
#   "data": [
#     { "id": "org-abc123", "name": "Acme Construction", "role": "admin" },
#     { "id": "org-xyz789", "name": "Waste Haulage Inc", "role": "editor" }
#   ]
# }
```

## Activity Records

### Import CSV Data

```bash
# 1. Create import batch
curl -X POST http://localhost:3000/api/orgs/org-abc123/imports \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Q3 2025 Energy Usage",
    "source": "utility_bills",
    "periodId": "period-q3-2025"
  }'

# Response:
# {
#   "id": "import-123",
#   "status": "uploading",
#   "uploadUrl": "https://metricora.r2.cloudflarestorage.com/org/org-abc123/imports/import-123/..."
# }

# 2. Upload CSV to presigned URL
curl -X PUT "https://metricora.r2.cloudflarestorage.com/org/org-abc123/imports/import-123/data.csv" \
  -H "Content-Type: text/csv" \
  --data-binary @energy-data.csv

# 3. Poll import status (GET the import itself; state field reflects progress)
curl -X GET http://localhost:3000/api/orgs/org-abc123/imports/import-123 \
  -b cookies.txt

# Response (while parsing):
# { "id": "import-123", "state": "parsing", "rowsParsed": 47, "totalRows": 125 }

# Response (after validation):
# {
#   "id": "import-123",
#   "state": "needs_attention",
#   "rowsParsed": 125,
#   "validRows": 120,
#   "errorRows": 5,
#   "errors": [
#     { "row": 23, "column": "weight", "error": "Invalid number: 'abc'" },
#     { "row": 45, "column": "date", "error": "Date format must be YYYY-MM-DD" }
#   ]
# }

# 4. Fix errors in source CSV and re-upload, OR approve to commit

# 5. Commit import (create activity records)
curl -X POST http://localhost:3000/api/orgs/org-abc123/imports/import-123/commit \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{ "idempotencyKey": "import-123-commit-v1" }'

# Response:
# {
#   "id": "import-123",
#   "status": "committed",
#   "recordsCreated": 120,
#   "createdAt": "2025-08-24T11:45:00Z"
# }
```

### List Activity Records

```bash
curl -X GET 'http://localhost:3000/api/orgs/org-abc123/activity-records?periodId=period-q3-2025&limit=20' \
  -b cookies.txt

# Response:
# {
#   "data": [
#     {
#       "id": "record-1",
#       "category": "s1-stationary",
#       "value": 2500.5,
#       "unit": "kWh",
#       "date": "2025-07-15",
#       "facility": { "id": "facility-main", "name": "Main Office" },
#       "createdBy": { "id": "user-123", "email": "manager@acme.com" }
#     }
#   ],
#   "pagination": {
#     "cursor": "record-1",
#     "hasMore": true
#   }
# }
```

### Create Activity Record (Manual Entry)

```bash
curl -X POST http://localhost:3000/api/orgs/org-abc123/activity-records \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "category": "s1-stationary",
    "value": 1250,
    "unit": "kWh",
    "date": "2025-08-20",
    "periodId": "period-q3-2025",
    "facilityId": "facility-main",
    "description": "Monthly office electricity usage",
    "evidence": {
      "type": "utility_bill",
      "billReference": "ACC-2025-08-001"
    }
  }'

# Response:
# {
#   "id": "record-manual-1",
#   "category": "s1-stationary",
#   "value": 1250,
#   "unit": "kWh",
#   "status": "draft",
#   "createdAt": "2025-08-24T14:20:00Z"
# }
```

## Calculations

### Run Calculation for Reporting Period

```bash
curl -X POST http://localhost:3000/api/orgs/org-abc123/calculation-runs \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "periodId": "period-q3-2025",
    "recalculateIfExists": true,
    "idempotencyKey": "calc-q3-2025-v2"
  }'

# Response:
# {
#   "id": "calc-run-789",
#   "status": "processing",
#   "periodId": "period-q3-2025",
#   "recordsToCalculate": 120,
#   "startedAt": "2025-08-24T15:00:00Z"
# }

# Poll for completion
curl -X GET http://localhost:3000/api/orgs/org-abc123/calculation-runs/calc-run-789 \
  -b cookies.txt

# Response (while processing):
# {
#   "id": "calc-run-789",
#   "status": "processing",
#   "recordsCalculated": 45,
#   "recordsTotal": 120,
#   "progress": 37.5
# }

# Response (completed):
# {
#   "id": "calc-run-789",
#   "status": "completed",
#   "recordsCalculated": 120,
#   "totals": {
#     "co2e": 2847.5,
#     "scope1": 450.2,
#     "scope2": 1205.3,
#     "scope3": 1192.0
#   },
#   "completedAt": "2025-08-24T15:12:30Z"
# }
```

### Get Calculation Details

```bash
curl -X GET http://localhost:3000/api/orgs/org-abc123/calculation-runs/calc-run-789/records?limit=10 \
  -b cookies.txt

# Response:
# {
#   "data": [
#     {
#       "recordId": "record-1",
#       "category": "s1-stationary",
#       "value": 2500.5,
#       "unit": "kWh",
#       "normalizedValue": 2500.5,
#       "normalizedUnit": "kWh",
#       "co2e": 1125.23,
#       "formula": "2500.5 * 0.450 (DEFRA 2025 electricity)",
#       "factorSource": "DEFRA 2025.1",
#       "factorUsed": "0.450 kg CO2e / kWh",
#       "selectionReason": "UK, scope2-location-based, 2025-Q3"
#     }
#   ],
#   "pagination": { "cursor": "record-1", "hasMore": true }
# }
```

## Dashboard & Aggregates

### Get Dashboard Overview

```bash
curl -X GET http://localhost:3000/api/orgs/org-abc123/dashboard \
  -b cookies.txt

# Response:
# {
#   "totalEmissions": {
#     "co2e": 15847.3,
#     "scope1": 3200.1,
#     "scope2": 8450.2,
#     "scope3": 4197.0
#   },
#   "byCategory": {
#     "s1-stationary": 2100.5,
#     "s1-mobile": 1099.6,
#     "s2-electricity-lb": 8450.2,
#     "s3-business-travel": 4197.0
#   },
#   "byFacility": [
#     { "facilityId": "facility-main", "name": "Main Office", "co2e": 8520.1 },
#     { "facilityId": "facility-warehouse", "name": "Warehouse", "co2e": 7327.2 }
#   ],
#   "trend": [
#     { "period": "2025-Q1", "co2e": 3200.5 },
#     { "period": "2025-Q2", "co2e": 3847.1 },
#     { "period": "2025-Q3", "co2e": 3600.9 }
#   ],
#   "lastUpdated": "2025-08-24T15:12:30Z"
# }
```

## Publishing Snapshots

### Publish Calculation as Snapshot

```bash
curl -X POST http://localhost:3000/api/orgs/org-abc123/snapshots \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "calculationRunId": "calc-run-789",
    "name": "Q3 2025 Official Report",
    "notes": "Reviewed and approved by Finance team",
    "idempotencyKey": "snapshot-q3-2025-official"
  }'

# Response:
# {
#   "id": "snapshot-q3-2025-off",
#   "periodId": "period-q3-2025",
#   "status": "published",
#   "totals": {
#     "co2e": 2847.5,
#     "scope1": 450.2,
#     "scope2": 1205.3,
#     "scope3": 1192.0
#   },
#   "publishedAt": "2025-08-24T16:00:00Z",
#   "publishedBy": { "id": "user-123", "name": "Jane Smith" }
# }
```

### List Published Snapshots

```bash
curl -X GET http://localhost:3000/api/orgs/org-abc123/snapshots \
  -b cookies.txt

# Response:
# {
#   "data": [
#     {
#       "id": "snapshot-q3-2025-off",
#       "periodId": "period-q3-2025",
#       "name": "Q3 2025 Official Report",
#       "status": "published",
#       "totals": { "co2e": 2847.5 },
#       "publishedAt": "2025-08-24T16:00:00Z"
#     },
#     {
#       "id": "snapshot-q2-2025-off",
#       "periodId": "period-q2-2025",
#       "name": "Q2 2025 Official Report",
#       "status": "published",
#       "totals": { "co2e": 2650.3 },
#       "publishedAt": "2025-05-30T14:20:00Z"
#     }
#   ]
# }
```

## Reports

### Generate PDF Report

```bash
curl -X POST http://localhost:3000/api/orgs/org-abc123/reports \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "snapshotId": "snapshot-q3-2025-off",
    "format": "pdf",
    "includeDetails": true,
    "idempotencyKey": "report-q3-2025-pdf-v1"
  }'

# Response:
# {
#   "id": "report-123",
#   "status": "generating",
#   "snapshotId": "snapshot-q3-2025-off",
#   "startedAt": "2025-08-24T16:30:00Z"
# }

# Poll for completion
curl -X GET http://localhost:3000/api/orgs/org-abc123/reports/report-123 \
  -b cookies.txt

# Response (when ready):
# {
#   "id": "report-123",
#   "status": "completed",
#   "downloadUrl": "https://metricora.r2.cloudflarestorage.com/org/org-abc123/reports/report-123/report.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...",
#   "expiresAt": "2025-08-24T16:45:00Z",
#   "generatedAt": "2025-08-24T16:35:00Z"
# }
```

## Field Submissions (Mobile)

### Create Field Submission

```bash
curl -X POST http://localhost:3000/api/orgs/org-abc123/field-submissions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "type": "waste_ticket",
    "wasteType": "general_waste",
    "weight": 450.5,
    "unit": "kg",
    "ewcCode": "200301",
    "date": "2025-08-24",
    "vehicleReg": "AB21CDE",
    "supplierName": "Local Waste Services",
    "gpsCoords": { "lat": 51.5074, "lng": -0.1278 },
    "photoUrl": "https://metricora.r2.cloudflarestorage.com/org/org-abc123/evidence/...",
    "idempotencyKey": "submission-mobile-001"
  }'

# Response:
# {
#   "id": "submission-001",
#   "status": "pending_review",
#   "type": "waste_ticket",
#   "weight": 450.5,
#   "createdAt": "2025-08-24T10:15:00Z",
#   "createdBy": { "id": "field-worker-123" }
# }
```

### Get Field Submission Status

```bash
curl -X GET http://localhost:3000/api/orgs/org-abc123/field-submissions/submission-001 \
  -H "Authorization: Bearer <token>"

# Response:
# {
#   "id": "submission-001",
#   "status": "approved",
#   "type": "waste_ticket",
#   "weight": 450.5,
#   "unit": "kg",
#   "createdAt": "2025-08-24T10:15:00Z",
#   "approvedAt": "2025-08-24T14:30:00Z",
#   "approvedBy": { "id": "user-456", "name": "Review Manager" },
#   "linkedRecordId": "record-from-submission-001"
# }
```

## User Management

### Invite User to Organization

```bash
curl -X POST http://localhost:3000/api/orgs/org-abc123/invites \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "email": "newuser@acme.com",
    "role": "editor",
    "expiresIn": 7  # Days
  }'

# Response:
# {
#   "id": "invite-123",
#   "email": "newuser@acme.com",
#   "role": "editor",
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "inviteUrl": "https://metricora.co.uk/join?token=eyJhbGc...",
#   "expiresAt": "2025-08-31T12:00:00Z"
# }
```

### Create Field Worker Invite Link

```bash
curl -X POST http://localhost:3000/api/orgs/org-abc123/field-worker-invites \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "supplierName": "Smith Waste Disposal",
    "contactName": "John Smith",
    "contactEmail": "john@smithwaste.com",
    "expiresIn": 30  # Days
  }'

# Response:
# {
#   "id": "field-invite-001",
#   "deepLink": "metricora://invite?token=eyJhbGc...",
#   "webLink": "https://metricora.co.uk/mobile/invite?token=eyJhbGc...",
#   "expiresAt": "2025-09-23T12:00:00Z",
#   "status": "pending"
# }
# Field worker opens deepLink in Flutter app → sets PIN → ready to submit evidence
```

### List Organization Members

```bash
curl -X GET http://localhost:3000/api/orgs/org-abc123/members \
  -b cookies.txt

# Response:
# {
#   "data": [
#     {
#       "userId": "user-123",
#       "email": "jane@acme.com",
#       "name": "Jane Smith",
#       "role": "admin",
#       "joinedAt": "2025-01-15T10:30:00Z"
#     },
#     {
#       "userId": "user-456",
#       "email": "john@acme.com",
#       "name": "John Doe",
#       "role": "editor",
#       "joinedAt": "2025-03-20T14:15:00Z"
#     }
#   ]
# }
```

## Error Handling

All errors follow this format:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid input data",
  "details": {
    "errors": [
      { "field": "email", "message": "Invalid email format" },
      { "field": "password", "message": "Password must be at least 8 characters" }
    ]
  }
}
```

Common error codes:

| Code | HTTP | Meaning |
|---|---|---|
| `AUTHENTICATION_REQUIRED` | 401 | No valid session/token |
| `AUTHORIZATION_FAILED` | 403 | User lacks required role |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `CONFLICT` | 409 | Duplicate or conflicting data |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_SERVER_ERROR` | 500 | Server error (check logs) |

## JavaScript Client Example

```javascript
// Minimal HTTP client for MetricOra API

class MetricOraClient {
  constructor(baseUrl, apiToken) {
    this.baseUrl = baseUrl;
    this.apiToken = apiToken;
  }

  async request(method, path, data = null) {
    const url = `${this.baseUrl}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiToken}`,
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const body = await response.json();

    if (!response.ok) {
      throw new Error(`${body.code}: ${body.message}`);
    }

    return body;
  }

  // Activity Records
  async listRecords(orgId, periodId) {
    return this.request('GET', `/api/orgs/${orgId}/activity-records?periodId=${periodId}`);
  }

  async createRecord(orgId, record) {
    return this.request('POST', `/api/orgs/${orgId}/activity-records`, record);
  }

  // Calculations
  async runCalculation(orgId, periodId) {
    return this.request('POST', `/api/orgs/${orgId}/calculation-runs`, {
      periodId,
      idempotencyKey: `calc-${periodId}-${Date.now()}`,
    });
  }

  // Dashboard
  async getDashboard(orgId) {
    return this.request('GET', `/api/orgs/${orgId}/dashboard`);
  }

  // Reports
  async generateReport(orgId, snapshotId) {
    return this.request('POST', `/api/orgs/${orgId}/reports`, {
      snapshotId,
      format: 'pdf',
      idempotencyKey: `report-${snapshotId}-${Date.now()}`,
    });
  }
}

// Usage
const client = new MetricOraClient('https://metricora.co.uk', 'your-api-token');
const dashboard = await client.getDashboard('org-abc123');
console.log('Total emissions:', dashboard.totalEmissions.co2e);
```

## Rate Limits

- **Authentication endpoints:** 5 requests / 15 minutes per IP
- **General API:** 100 requests / minute per user
- **File uploads:** 50 MB / request, 1 GB / day per org
- **Batch operations:** 25k records / import, 100 concurrent jobs max

## Resources

- **Developer Guide:** `docs/developers.md`
- **Emissions Walkthrough:** `docs/emissions-walkthrough.md`
- **Operations Guide:** `docs/operators.md`
