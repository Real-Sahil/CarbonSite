# IoT Device Integration

## Overview

The IoT Device Integration enables real-time meter data ingestion into CarbonSite, eliminating manual CSV imports for utilities and facilities. Connect electric meters, gas meters, fuel pumps, and water meters to automatically capture Scope 1 and Scope 2 emissions data.

**Supported device types:**
- Electricity Meter → `s2-electricity-lb` (location-based grid electricity)
- Gas Meter → `s1-stationary` (direct fuel combustion)
- Fuel Pump → `s1-mobile` (company vehicle fuel)
- Water Meter → `s3-purchased-goods` (placeholder for Phase 2)

## Quick Start

### 1. Register a Device

Use the admin Settings > Integrations > IoT Devices page or call the API:

```bash
curl -X POST https://your-app.com/api/orgs/{orgId}/iot-devices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-auth-token>" \
  -d '{
    "name": "Main Building Electricity",
    "deviceType": "electricity_meter",
    "serialNumber": "METER-001",
    "facilityId": "facility-123"
  }'
```

**Response:**
```json
{
  "device": {
    "id": "device-456",
    "name": "Main Building Electricity",
    "deviceType": "electricity_meter",
    "serialNumber": "METER-001",
    "emissionCategoryCode": "s2-electricity-lb",
    "isActive": true,
    "createdAt": "2026-08-27T12:00:00Z"
  },
  "credential": {
    "credentialId": "cred-789",
    "apiKey": "iot_sk_4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f",
    "prefix": "4a5b6c7d",
    "expiresAt": "2027-08-27T12:00:00Z"
  }
}
```

**Save the API key securely.** You won't see it again.

### 2. Configure Your Device

Set your meter/sensor to send readings to:

```
POST https://your-app.com/api/orgs/{orgId}/webhooks/meters
Authorization: Bearer {apiKey}
Content-Type: application/json
```

### 3. Send Meter Readings

Your device will POST readings like this:

```json
{
  "deviceId": "device-456",
  "timestamp": "2026-08-27T14:30:00Z",
  "rawValue": 1250.5,
  "rawUnit": "kWh",
  "metadata": {
    "deviceName": "Main Building Electricity",
    "temperature": 22
  }
}
```

Readings are processed automatically:
- Unit normalization (kWh → canonical unit)
- Duplicate detection (10-second tolerance, ±1% value diff)
- Activity record creation (if emission factor available)
- Audit trail recording

## API Reference

### Register Device

**POST** `/api/orgs/{orgId}/iot-devices`

Register a new meter or sensor.

**Request:**
```json
{
  "name": "Main Building Electricity",
  "deviceType": "electricity_meter",
  "serialNumber": "METER-001",
  "facilityId": "facility-123"
}
```

**Response:** `201 Created`
```json
{
  "device": { ... },
  "credential": { ... }
}
```

### List Devices

**GET** `/api/orgs/{orgId}/iot-devices?cursor=&take=50`

List registered devices with pagination.

**Response:** `200 OK`
```json
{
  "devices": [
    {
      "id": "device-456",
      "name": "Main Building Electricity",
      "deviceType": "electricity_meter",
      "serialNumber": "METER-001",
      "isActive": true,
      "lastReadingAt": "2026-08-27T14:30:00Z",
      "facility": { "id": "facility-123", "name": "HQ Building" },
      "credentials": [
        { "id": "cred-789", "prefix": "4a5b6c7d", "createdAt": "2026-08-27T12:00:00Z" }
      ],
      "_count": { "readings": 42 }
    }
  ],
  "nextCursor": null
}
```

### Get Device Details

**GET** `/api/orgs/{orgId}/iot-devices/{deviceId}`

Retrieve device configuration and credentials.

**Response:** `200 OK`
```json
{
  "device": { ... }
}
```

### Update Device

**PATCH** `/api/orgs/{orgId}/iot-devices/{deviceId}`

Update device name or facility assignment.

**Request:**
```json
{
  "name": "East Wing Electricity",
  "facilityId": "facility-124"
}
```

**Response:** `200 OK`
```json
{
  "device": { ... }
}
```

### Deactivate Device

**DELETE** `/api/orgs/{orgId}/iot-devices/{deviceId}`

Deactivate a device and revoke all API credentials.

**Response:** `200 OK`
```json
{
  "success": true
}
```

### Create Credential

**POST** `/api/orgs/{orgId}/iot-devices/{deviceId}`

Generate a new API key for this device (useful for key rotation).

**Request:**
```json
{
  "action": "create_credential"
}
```

**Response:** `201 Created`
```json
{
  "credentialId": "cred-999",
  "apiKey": "iot_sk_...",
  "prefix": "8a9b0c1d",
  "expiresAt": "2027-08-27T12:00:00Z"
}
```

### Submit Meter Reading (Webhook)

**POST** `/api/orgs/{orgId}/webhooks/meters`

Submit a meter reading from your device.

**Authentication:** Bearer token (API key) in Authorization header

**Request:**
```json
{
  "deviceId": "device-456",
  "timestamp": "2026-08-27T14:30:00Z",
  "rawValue": 1250.5,
  "rawUnit": "kWh",
  "metadata": {
    "deviceName": "Main Building Electricity",
    "temperature": 22
  }
}
```

**Response:** `201 Created`
```json
{
  "meterReadingId": "reading-123",
  "isDuplicate": false,
  "normalizedQuantity": 1250.5,
  "normalizedUnit": "kWh",
  "activityRecordId": "record-456"
}
```

### List Meter Readings

**GET** `/api/orgs/{orgId}/meter-readings?deviceId=device-456&cursor=&take=50`

Retrieve meter readings with pagination.

**Response:** `200 OK`
```json
{
  "readings": [
    {
      "id": "reading-123",
      "timestamp": "2026-08-27T14:30:00Z",
      "rawValue": 1250.5,
      "rawUnit": "kWh",
      "normalizedQuantity": 1250.5,
      "normalizedUnit": "kWh",
      "isDuplicate": false,
      "device": {
        "name": "Main Building Electricity",
        "serialNumber": "METER-001",
        "deviceType": "electricity_meter"
      },
      "activityRecord": {
        "id": "record-456",
        "co2e": 375.15
      }
    }
  ],
  "nextCursor": null
}
```

## Device Types & Emission Mapping

| Device Type | Emission Scope | Category | Description |
|---|---|---|---|
| `electricity_meter` | Scope 2 | `s2-electricity-lb` | Purchased grid electricity, location-based |
| `gas_meter` | Scope 1 | `s1-stationary` | Direct fuel combustion (boilers, furnaces) |
| `fuel_pump` | Scope 1 | `s1-mobile` | Company vehicle fleet fuel |
| `water_meter` | Scope 3 | `s3-purchased-goods` | Placeholder (refinement in Phase 2) |

## Authentication

All requests to the webhook endpoint use **Bearer token authentication**:

```bash
Authorization: Bearer {apiKey}
```

The API key is a 64-character hex string (SHA-256). Store it securely (e.g., environment variables, secret manager). **Treat API keys like passwords — never commit them to version control or share them in logs.**

### Key Rotation

To rotate an API key:
1. Create a new credential: `POST /api/orgs/{orgId}/iot-devices/{deviceId}` with `action: create_credential`
2. Update your device configuration with the new key
3. Confirm readings are received with the new key
4. Delete the old credential (optional — old credentials will be revoked if device is deactivated)

## Data Processing

### Unit Normalization

Raw meter readings are normalized to canonical units:
- Electricity: `kWh`, `MWh`, `Wh` → `kWh`
- Gas: `m³`, `kWh` (calorific value), `MJ` → `m³` or `kWh`
- Fuel: `litres`, `gallons`, `kg` → `litres`
- Water: `m³`, `litres`, `gallons` → `m³`

Normalization is logged in the meter reading record for audit purposes.

### Duplicate Detection

Readings submitted within 10 seconds of an existing reading at the same device are checked:
- If the raw value is identical or differs by <1%, marked as duplicate
- Duplicate readings are recorded but do not create activity records
- Duplicate detection window is configurable (currently 10 seconds)

### Automatic Activity Record Creation

When a non-duplicate reading is received:
1. Device's reporting period is identified (based on reading timestamp)
2. Emission factor is selected for the device's category + location + date
3. CO2e is calculated using the factor and reading quantity
4. Activity record is created with status `approved` (trusted source)
5. Meter reading is linked to the activity record
6. Audit trail records the processing

If no reporting period or factor is available, the meter reading is still recorded; activity record creation is skipped and logged.

## Error Handling

### Authentication Errors

**401 Unauthorized**
```json
{
  "code": "UNAUTHORIZED",
  "message": "Invalid API key"
}
```

**403 Forbidden**
```json
{
  "code": "FORBIDDEN",
  "message": "API key does not match this device"
}
```

### Validation Errors

**400 Bad Request**
```json
{
  "code": "INVALID_INPUT",
  "message": "Invalid request body",
  "details": [
    {
      "path": ["rawValue"],
      "message": "Expected number"
    }
  ]
}
```

### Not Found Errors

**404 Not Found**
```json
{
  "code": "NOT_FOUND",
  "message": "Device not found"
}
```

## Examples

### cURL: Register Device

```bash
curl -X POST https://your-app.com/api/orgs/org-123/iot-devices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-org-token>" \
  -d '{
    "name": "Building A Electric Meter",
    "deviceType": "electricity_meter",
    "serialNumber": "EM-2024-001",
    "facilityId": "fac-456"
  }'
```

### cURL: Submit Meter Reading

```bash
curl -X POST https://your-app.com/api/orgs/org-123/webhooks/meters \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer iot_sk_4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f" \
  -d '{
    "deviceId": "device-456",
    "timestamp": "2026-08-27T14:30:00Z",
    "rawValue": 1250.5,
    "rawUnit": "kWh",
    "metadata": {
      "deviceName": "Building A Electric Meter",
      "temperature": 22
    }
  }'
```

### Python: Periodic Meter Reading Submission

```python
import requests
import json
from datetime import datetime, timedelta

API_KEY = "iot_sk_..."
ORG_ID = "org-123"
DEVICE_ID = "device-456"
BASE_URL = "https://your-app.com"

def submit_meter_reading(raw_value, raw_unit):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "deviceId": DEVICE_ID,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "rawValue": raw_value,
        "rawUnit": raw_unit,
        "metadata": {
            "deviceName": "Building A Electric Meter"
        }
    }
    
    response = requests.post(
        f"{BASE_URL}/api/orgs/{ORG_ID}/webhooks/meters",
        headers=headers,
        json=payload
    )
    
    if response.status_code == 201:
        result = response.json()
        print(f"Reading submitted: {result['meterReadingId']}")
        if result.get('activityRecordId'):
            print(f"Activity record created: {result['activityRecordId']}")
        if result.get('isDuplicate'):
            print("Note: This reading was a duplicate")
    else:
        print(f"Error: {response.status_code}")
        print(response.json())

# Example: submit daily reading at noon
submit_meter_reading(1250.5, "kWh")
```

### Node.js: Real-time Meter Reading Submission

```javascript
const axios = require('axios');

const apiKey = 'iot_sk_...';
const orgId = 'org-123';
const deviceId = 'device-456';
const baseUrl = 'https://your-app.com';

async function submitReading(rawValue, rawUnit) {
  try {
    const response = await axios.post(
      `${baseUrl}/api/orgs/${orgId}/webhooks/meters`,
      {
        deviceId,
        timestamp: new Date().toISOString(),
        rawValue,
        rawUnit,
        metadata: {
          deviceName: 'Building A Electric Meter'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Reading submitted:', response.data.meterReadingId);
    if (response.data.activityRecordId) {
      console.log('Activity record:', response.data.activityRecordId);
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Submit a reading every hour
setInterval(() => {
  submitReading(1250.5, 'kWh');
}, 3600000);
```

## Troubleshooting

### "Invalid API key" error

- Verify the API key is correct (check in Settings > Integrations > IoT Devices)
- Confirm the key hasn't been revoked
- If you lost the key, create a new credential via the API

### Readings not creating activity records

- Check that a reporting period exists for the reading date
- Verify the device's emission category has available factors
- Check audit log for processing errors

### Device serial number already exists

- Each serial number must be unique within your organization
- If re-registering a device, first deactivate the old one

### High duplicate rate

- Check if your device is sending readings too frequently
- Verify the device's timestamp is correct (UTC)
- Consider increasing the submission interval

## Support

For issues or questions:
1. Check the audit log (Settings > Audit) for processing errors
2. Review meter readings and device status in Settings > Integrations
3. Contact support with your device ID and reading timestamp for investigation

## Roadmap

**Phase 1b (Current):**
- ✅ Device registration and credential management
- ✅ Meter reading webhook receiver
- ✅ Unit normalization and duplicate detection
- ✅ Automatic activity record creation

**Phase 2 (Planned):**
- Water meter handling (Scope 3 mapping refinement)
- Device health monitoring (low battery, connectivity issues)
- Anomaly detection (unusual readings, threshold alerts)
- Bulk device import via CSV
- Real-time dashboard widget showing latest readings
- Mobile app deep link for device QR code scanning

**Phase 3 (Future):**
- Multi-region factor library support
- Custom unit mappings per device
- Integration with IoT platforms (Azure IoT Hub, AWS IoT Core, Google Cloud IoT)
- Historical data backfill from SCADA systems
