# Webhook/API Ingestion Guide

**Endpoint:** `POST /api/orgs/{orgId}/integrations/webhooks/ingest`

**Authentication:** API Key (Bearer token in Authorization header)

**Purpose:** Generic webhook endpoint for third-party data connectors (Xero, utilities, fleet, corporate cards, etc.). Converts external data into staged activity records for review and commitment.

---

## Quick Start

### 1. Create an API Key

An admin can create an API key for programmatic access via the dashboard (UI pending). For now, use `POST /api/orgs/{orgId}/api-keys`:

```bash
curl -X POST https://carbonsite.io/api/orgs/{orgId}/api-keys \
  -H "Authorization: Bearer {user_session_token}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Xero Integration"}'
```

Response:
```json
{
  "id": "key_abc123",
  "name": "Xero Integration",
  "key": "key_abc123_sk_...", // Save this securely — it won't be shown again
  "prefix": "key_abc123_",
  "expiresAt": null,
  "createdAt": "2026-08-25T10:00:00Z"
}
```

### 2. Send Data to the Webhook

```bash
curl -X POST https://carbonsite.io/api/orgs/{orgId}/integrations/webhooks/ingest \
  -H "Authorization: Bearer {api_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "xero",
    "reportingPeriodId": "{periodId}",
    "payload": {
      "rows": [
        {
          "InvoiceNumber": "INV-001",
          "Date": "2026-08-25",
          "Supplier": "Fuel Supplier Co",
          "Amount": "1500.00",
          "Currency": "GBP",
          "Account": "5001",
          "Description": "Fleet fuel - diesel"
        }
      ]
    }
  }'
```

Response (HTTP 202 Accepted):
```json
{
  "code": "INGESTION_SUCCESS",
  "message": "Ingested 1 records from xero",
  "data": {
    "importBatchId": "batch_xyz123",
    "recordCount": 1,
    "provider": "xero",
    "reportingPeriodId": "{periodId}"
  }
}
```

### 3. Review & Commit Records

Staged records appear in the CarbonSite dashboard under **Imports → Review**. Users can:
- View parsed fields and validation warnings
- Edit values before commitment
- Mark records as ready for calculation
- Commit approved records to create ActivityRecords

---

## Request Schema

```typescript
POST /api/orgs/{orgId}/integrations/webhooks/ingest

Headers:
  Authorization: Bearer {api_key}
  Content-Type: application/json

Body:
{
  "provider": "xero" | "quickbooks" | "sage" | "utilities" | "fleet" | "corporate_cards",
  "reportingPeriodId": "period_abc123",  // Optional; defaults to latest period
  "payload": {
    // Provider-specific payload (see below)
  }
}
```

---

## Provider Payloads

### Xero (Accounting)

Ingest Xero invoices/bills to extract spend-based emissions.

```json
{
  "provider": "xero",
  "payload": {
    "rows": [
      {
        "InvoiceNumber": "INV-001",
        "Date": "2026-08-25",  // ISO or DD/MM/YYYY format
        "Supplier": "Acme Fuels",
        "Amount": "1500.00",  // Supports comma separators: "1,500.00"
        "Currency": "GBP",
        "Account": "5001",  // Account code (mapped to emission category)
        "Description": "Fleet fuel - diesel"
      }
    ],
    "externalBatchId": "xero_export_20260825"  // Optional
  }
}
```

**Account → Category Mapping:**
| Account | Category | Scope |
|---------|----------|-------|
| 5000 | s1-stationary | Fuel & heating |
| 5001 | s1-mobile | Fleet fuel |
| 5100 | s2-electricity-lb | Electricity |
| 6000 | s3-purchased-goods | Goods & materials (spend-based fallback) |
| 6001 | s3-upstream-transport | Logistics & freight |
| 6100 | s3-business-travel | Employee travel |

**Quality Notes:**
- Spend-based records (no physical quantity) are marked as **high uncertainty** and auto-trigger supplier data requests (Art. 17 of the roadmap).
- Users should provide physical quantities where possible (e.g., "100 litres diesel" in description).

---

### QuickBooks (Coming Soon)

Placeholder for QuickBooks Online API integration.

```json
{
  "provider": "quickbooks",
  "payload": {
    "rows": [...],
    "externalBatchId": "qbo_sync_20260825"
  }
}
```

---

### Utilities (Coming Soon)

Ingest meter readings and utility bills (gas, electricity, water, waste).

```json
{
  "provider": "utilities",
  "payload": {
    "rows": [
      {
        "meterId": "METER-001",
        "meterType": "electricity",  // gas | electricity | water | waste
        "readingDate": "2026-08-25",
        "usage": "1500.00",
        "unit": "kWh",
        "supplier": "National Grid",
        "meterPostcode": "SW1A 1AA"
      }
    ]
  }
}
```

---

### Fleet Telematics (Coming Soon)

Ingest GPS/distance data from fleet management systems (Geotab, Samsara, etc.).

```json
{
  "provider": "fleet",
  "payload": {
    "rows": [
      {
        "vehicleId": "VEHICLE-001",
        "dateRange": {"start": "2026-08-01", "end": "2026-08-31"},
        "distanceTraveled": 1500.0,
        "unit": "km",
        "fuelType": "diesel",
        "region": "UK"
      }
    ]
  }
}
```

---

### Corporate Cards (Coming Soon)

Ingest corporate card transaction feeds to extract travel & expenses.

```json
{
  "provider": "corporate_cards",
  "payload": {
    "rows": [
      {
        "transactionId": "TXN-001",
        "date": "2026-08-25",
        "merchant": "Airlines Ltd",
        "amount": 500.0,
        "currency": "GBP",
        "category": "business_travel"  // Mapped to s3-business-travel
      }
    ]
  }
}
```

---

## Response Codes

| Code | Status | Meaning |
|------|--------|---------|
| 202 | Accepted | Webhook received & staged successfully |
| 400 | Bad Request | Invalid request schema, provider, or payload |
| 401 | Unauthorized | Missing/invalid/expired API key |
| 404 | Not Found | Organization or reporting period not found |
| 500 | Server Error | Connector or database error (retry safe) |

---

## Error Handling

All errors return a structured JSON response:

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable message",
  "details": "Additional context (optional)"
}
```

**Common error codes:**
- `MISSING_API_KEY` — No Authorization header
- `INVALID_API_KEY` — Key doesn't exist or is expired
- `VALIDATION_ERROR` — Invalid request schema
- `CONNECTOR_ERROR` — Provider-specific parsing failed
- `NO_REPORTING_PERIOD` — Org has no periods (specify one)

---

## Idempotency

The webhook endpoint does **not** enforce request idempotency (same data sent twice will create duplicate batches). For idempotent behavior, include `externalBatchId` in the payload — future invocations with the same ID will detect duplicates and return early (implementation pending).

---

## Rate Limiting

- **Per API key:** 10 requests/minute
- **Per org:** 100 requests/minute
- **Payload size:** 10 MB max

Exceeding limits returns `429 Too Many Requests`.

---

## Staging Flow

1. **Ingest** → Webhook endpoint receives & validates payload
2. **Stage** → Connector transforms data into `StagedActivityRecord` rows
3. **Review** → Users see records in the dashboard with validation errors/warnings
4. **Commit** → Approved records convert to `ActivityRecord` rows ready for calculation
5. **Calculate** → Next calculation run includes newly committed records

---

## Example: Xero Integration via Zapier

Connect Xero to CarbonSite via Zapier's Webhook action:

1. Create Zapier trigger: "New Xero Invoice"
2. Add action: "Webhooks by Zapier → POST"
3. Set URL: `https://carbonsite.io/api/orgs/{orgId}/integrations/webhooks/ingest`
4. Headers: `Authorization: Bearer {api_key}`
5. Payload:
   ```json
   {
     "provider": "xero",
     "reportingPeriodId": "{reportingPeriodId}",
     "payload": {
       "rows": [{
         "InvoiceNumber": "{{invoice_id}}",
         "Date": "{{invoice_date}}",
         "Supplier": "{{contact_name}}",
         "Amount": "{{total}}",
         "Currency": "GBP",
         "Account": "{{account_code}}",
         "Description": "{{description}}"
       }]
     }
   }
   ```

---

## Support & Roadmap

- **Beta status** — API subject to change
- **Coming next:** QuickBooks, utilities, fleet, corporate cards adapters
- **Contact:** [support@carbonsite.io](mailto:support@carbonsite.io)
