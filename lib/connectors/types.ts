// Connector interface for third-party data ingestion (Xero, utilities, fleet, etc).
// All connectors normalize their payloads into ActivityRecord-compatible JSON.

import type { Decimal } from "@prisma/client/runtime/library";

export interface ConnectorPayload {
  records: ConnectorActivityRecord[];
  metadata: ConnectorMetadata;
}

export interface ConnectorMetadata {
  provider: string; // "xero", "quickbooks", "utility_supplier_x", "fleet_telematics", etc.
  ingestionDate: Date;
  sourceSystem?: string; // e.g. "invoice_registry", "meter_readings", "fleet_gps"
  externalBatchId?: string; // Reference to external system batch
}

export interface ConnectorActivityRecord {
  // Transaction-level identifiers (for idempotency & linking)
  externalRecordId: string; // External system's unique ID
  externalBatchId?: string;

  // Emission calculation essentials
  emissionCategoryCode: string; // e.g. "s1-stationary", "s2-electricity-lb", "s3-business-travel"
  activityDate?: Date;
  startDate?: Date;
  endDate?: Date;

  // Physical quantity (amount + unit)
  amount: number;
  unit: string; // e.g. "kg", "tonnes", "kWh", "km", "liters"

  // Financial quantity (optional, for spend-based fallback)
  spendAmount?: number;
  spendCurrency?: string; // e.g. "GBP", "USD"

  // Optional context
  sourceDescription?: string; // e.g. "Invoice #12345", "Monthly utility bill"
  supplierName?: string;
  facilityCode?: string; // Match against existing Facility.externalId or name
  businessUnitCode?: string;
  country?: string;
  region?: string;

  // Location/routing (for distance-based emissions)
  pickupPostcode?: string;
  deliveryPostcode?: string;
  pickupCoordinates?: { lat: number; lng: number };
  deliveryCoordinates?: { lat: number; lng: number };

  // Scope 2 method selection (electricity only)
  scope2Method?: "location_based" | "market_based";

  // Detailed emission categories (gas-specific inputs)
  fuelType?: string; // "diesel", "petrol", "natural_gas", "electricity"
  transportMode?: string; // "truck", "van", "car", "flight", "rail"
  refrigerantType?: string; // "r410a", etc.

  // Validation & quality flags
  validationWarnings?: string[];
}

// Connector adapter interface — implemented by Xero, utilities, etc.
export interface IConnector {
  // Validate & transform external payload into normalized ConnectorActivityRecord[].
  // Throws or returns validation errors (non-fatal) — records with errors are still staged for review.
  ingest(payload: unknown): Promise<ConnectorPayload>;

  // Optional: Verify credential/auth token is still valid
  verifyCredentials?(): Promise<boolean>;

  // Connector metadata
  name: string;
  version: string;
}

// Staged record status after validation
export enum StagedRecordValidationLevel {
  VALID = "valid",
  WARNING = "warning",
  ERROR = "error",
}

export interface StagedRecordValidation {
  level: StagedRecordValidationLevel;
  errors: string[];
  warnings: string[];
}
