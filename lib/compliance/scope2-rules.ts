/**
 * Scope 2 Compliance Rules Engine
 * Implements machine-executable GHG Protocol Scope 2 dual-reporting requirements
 * Reference: GHG Protocol Scope 2 Guidance (2015)
 *
 * Scope 2 requires dual reporting:
 * - Location-based: Grid average emission factors
 * - Market-based: Renewable energy contracts, green tariffs, RECs
 *
 * This module ensures compliance by:
 * 1. Validating factor availability for both methods
 * 2. Recording audit trail via lifecycle stages
 * 3. Implementing deterministic fallback logic
 * 4. Documenting compliance rationale
 */

export type Scope2Method = "location_based" | "market_based";

export type Scope2ComplianceStage =
  | "pre_calculation" // Input validation
  | "runtime_inference" // Factor selection
  | "post_audit"; // Compliance recording

export type Scope2ComplianceRecord = {
  // Primary calculation
  activityRecordId: string;
  emissionCalculationId: string;

  // Dual reporting
  locationBasedTotalCo2e: number;
  marketBasedTotalCo2e?: number; // Null if no market factors available

  // Factor selection audit trail
  locationBasedFactorId: string;
  marketBasedFactorId?: string;

  // Compliance metadata
  reportingMethod: "dual" | "location_based_only"; // What was reported
  marketFactorAvailability: "available" | "not_available" | "fallback_applied";
  fallbackReason?: string; // Why we fell back to location-based

  // Lifecycle tracking
  lifecycle: {
    stage: Scope2ComplianceStage;
    timestamp: Date;
    validations: string[];
    warnings: string[];
  }[];

  // GHG Protocol compliance notes
  complianceNotes: string;
};

/**
 * Validate Scope 2 compliance for a calculation
 * Ensures dual-reporting requirements are met
 */
export function validateScope2Compliance(input: {
  category: string;
  locationBasedFactorId: string | null;
  marketBasedFactorId: string | null;
  activityType?: string;
  country?: string;
}): {
  isCompliant: boolean;
  method: "dual" | "location_based_only";
  reason: string;
  marketFactorStatus: "available" | "not_available" | "fallback_applied";
} {
  const validations: string[] = [];
  const warnings: string[] = [];

  // Pre-calculation validation
  if (!input.category.includes("electricity")) {
    return {
      isCompliant: true,
      method: "location_based_only",
      reason: "Non-electricity category; Scope 2 dual-reporting not required",
      marketFactorStatus: "not_available",
    };
  }

  validations.push("Category is electricity — Scope 2 dual-reporting required");

  // Runtime inference: Check factor availability
  const hasLocationBased = input.locationBasedFactorId != null;
  const hasMarketBased = input.marketBasedFactorId != null;

  if (!hasLocationBased) {
    return {
      isCompliant: false,
      method: "location_based_only",
      reason: "No location-based factor found — cannot calculate Scope 2",
      marketFactorStatus: "not_available",
    };
  }

  validations.push(`Location-based factor available: ${input.locationBasedFactorId}`);

  // Dual-reporting logic
  if (hasMarketBased) {
    validations.push(`Market-based factor available: ${input.marketBasedFactorId}`);
    return {
      isCompliant: true,
      method: "dual",
      reason: "Both location-based and market-based factors available; dual reporting required",
      marketFactorStatus: "available",
    };
  }

  // Fallback: Location-based only
  warnings.push(
    `No market-based factor for ${input.country} ${input.activityType || "default"}; falling back to location-based only`,
  );

  return {
    isCompliant: true,
    method: "location_based_only",
    reason: "Market-based factor not available; location-based used as fallback per GHG Protocol Scope 2 Guidance",
    marketFactorStatus: "fallback_applied",
  };
}

/**
 * Record Scope 2 compliance audit trail
 * Tracks decision-making for dual-reporting with immutable log
 */
export function recordScope2ComplianceAudit(input: {
  activityRecordId: string;
  emissionCalculationId: string;
  locationBasedTotalCo2e: number;
  marketBasedTotalCo2e?: number;
  locationBasedFactorId: string;
  marketBasedFactorId?: string;
  reportingMethod: "dual" | "location_based_only";
  marketFactorAvailability: "available" | "not_available" | "fallback_applied";
  fallbackReason?: string;
  activityType?: string;
  country?: string;
}): Scope2ComplianceRecord {
  const now = new Date();

  // Build audit trail with lifecycle stages
  const lifecycle = [
    {
      stage: "pre_calculation" as const,
      timestamp: now,
      validations: [
        `Activity type: ${input.activityType || "not specified"}`,
        `Country: ${input.country || "not specified"}`,
        `Market factor availability: ${input.marketFactorAvailability}`,
      ],
      warnings: input.fallbackReason ? [input.fallbackReason] : [],
    },
    {
      stage: "runtime_inference" as const,
      timestamp: now,
      validations: [
        `Location-based factor selected: ${input.locationBasedFactorId}`,
        ...(input.marketBasedFactorId ? [`Market-based factor selected: ${input.marketBasedFactorId}`] : []),
      ],
      warnings: input.marketFactorAvailability === "fallback_applied" ? [`Using location-based as fallback`] : [],
    },
    {
      stage: "post_audit" as const,
      timestamp: now,
      validations: [
        `Reporting method: ${input.reportingMethod}`,
        `Location-based CO2e: ${input.locationBasedTotalCo2e} kg`,
        ...(input.marketBasedTotalCo2e ? [`Market-based CO2e: ${input.marketBasedTotalCo2e} kg`] : []),
      ],
      warnings: [],
    },
  ];

  // GHG Protocol compliance notes
  const complianceNotes =
    input.reportingMethod === "dual"
      ? `GHG Protocol Scope 2 Guidance requires dual reporting. Location-based: ${input.locationBasedTotalCo2e.toFixed(2)} kg; Market-based: ${input.marketBasedTotalCo2e?.toFixed(2)} kg. Recommend reporting both to stakeholders.`
      : `GHG Protocol Scope 2 Guidance recommends dual reporting. Market-based factor unavailable (${input.fallbackReason || "not found"}); location-based only reported: ${input.locationBasedTotalCo2e.toFixed(2)} kg. Consider investigating market-based alternatives.`;

  return {
    activityRecordId: input.activityRecordId,
    emissionCalculationId: input.emissionCalculationId,
    locationBasedTotalCo2e: input.locationBasedTotalCo2e,
    marketBasedTotalCo2e: input.marketBasedTotalCo2e,
    locationBasedFactorId: input.locationBasedFactorId,
    marketBasedFactorId: input.marketBasedFactorId,
    reportingMethod: input.reportingMethod,
    marketFactorAvailability: input.marketFactorAvailability,
    fallbackReason: input.fallbackReason,
    lifecycle,
    complianceNotes,
  };
}

/**
 * Scope 2 Fallback Chain (GHG Protocol deterministic matching)
 * Priority: exact match > geography > activity type > global default
 */
export function getScope2FactorFallbackChain(
  country: string | undefined,
  activityType: string | undefined,
): { priority: number; description: string }[] {
  const chain = [
    {
      priority: 1,
      description: `Exact match: ${country || "global"} + ${activityType || "default"} + location-based`,
    },
    {
      priority: 2,
      description: `Geography match: ${country || "global"} + location-based`,
    },
    {
      priority: 3,
      description: `Activity type fallback: ${activityType || "default"} + location-based (any country)`,
    },
    {
      priority: 4,
      description: "Global default: location-based electricity factor",
    },
  ];

  return chain;
}

/**
 * Validate Scope 2 dual-reporting compliance for reporting
 * Ensures published reports show both methods or explain why not
 */
export function validateScope2ReportingCompliance(records: Scope2ComplianceRecord[]): {
  compliant: boolean;
  dualReportingCount: number;
  locationOnlyCount: number;
  recommendations: string[];
} {
  const dualReporting = records.filter((r) => r.reportingMethod === "dual");
  const locationOnly = records.filter((r) => r.reportingMethod === "location_based_only");

  const recommendations: string[] = [];

  if (locationOnly.length > 0) {
    recommendations.push(
      `${locationOnly.length} records using location-based only. Consider investigating market-based factors for these records.`,
    );
  }

  if (dualReporting.length === 0 && locationOnly.length > 0) {
    recommendations.push(
      "No dual reporting detected. GHG Protocol recommends dual reporting where possible. Include explanation in report.",
    );
  }

  return {
    compliant: locationOnly.length === 0 || dualReporting.length > 0,
    dualReportingCount: dualReporting.length,
    locationOnlyCount: locationOnly.length,
    recommendations,
  };
}
