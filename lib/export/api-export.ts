// API-first export — expose report and dashboard data via authenticated API
// Allows third-party systems to query emission data programmatically

import { z } from "zod";

export interface APIExportOptions {
  format: "json" | "csv" | "json-ld"; // JSON-LD for semantic data interoperability
  includeUncertainty?: boolean;
  includeLineage?: boolean; // Include source activity records and factors
  granularity?: "summary" | "detailed"; // Summary = scopes only, detailed = by category
}

export interface DashboardSnapshot {
  organizationId: string;
  reportingPeriodId: string;
  publishedAt: Date;
  methodology: string;
  dataQualityScore: number; // 0-1, aggregate confidence

  // Scope totals (tonnes CO2e)
  scope1: number;
  scope2LB: number;
  scope2MB: number;
  scope3: number;
  totalEmissions: number;

  // By category (optional detailed breakdown)
  byCategory?: Record<string, number>;

  // Uncertainty bands (optional)
  uncertainty?: {
    lower95: number;
    upper95: number;
  };

  // Lineage (optional)
  sourceCount?: number;
  lastUpdated?: Date;
}

export interface ActivityRecordExport {
  id: string;
  externalRecordId: string;
  emissionCategoryCode: string;
  activityDate: Date;
  amount: number;
  unit: string;
  co2eAmount: number;
  calculationFormula: string;
  factorId: string;
  factorLibraryVersion: string;
  dataQualityFlags: string[];
}

/**
 * Export dashboard snapshot to JSON-LD for semantic web compatibility
 * Enables RDF querying and integration with semantic data systems
 */
export function dashboardToJSONLD(dashboard: DashboardSnapshot): Record<string, unknown> {
  return {
    "@context": {
      "@vocab": "https://carbonsite.io/schema/emissions#",
      qudt: "http://qudt.org/schema/qudt/",
      skos: "http://www.w3.org/2004/02/skos/core#",
    },
    "@type": "EmissionInventory",
    "@id": `urn:carbonsite:snapshot:${dashboard.reportingPeriodId}`,
    organization: {
      "@id": `urn:carbonsite:org:${dashboard.organizationId}`,
    },
    reportingPeriod: dashboard.reportingPeriodId,
    publishedAt: dashboard.publishedAt.toISOString(),
    methodology: dashboard.methodology,
    dataQualityScore: dashboard.dataQualityScore,

    emissions: {
      scope1: {
        "@type": "qudt:QuantityValue",
        value: dashboard.scope1,
        "qudt:hasUnit": "tCO2e",
      },
      scope2LocationBased: {
        "@type": "qudt:QuantityValue",
        value: dashboard.scope2LB,
        "qudt:hasUnit": "tCO2e",
      },
      scope2MarketBased: {
        "@type": "qudt:QuantityValue",
        value: dashboard.scope2MB,
        "qudt:hasUnit": "tCO2e",
      },
      scope3: {
        "@type": "qudt:QuantityValue",
        value: dashboard.scope3,
        "qudt:hasUnit": "tCO2e",
      },
      total: {
        "@type": "qudt:QuantityValue",
        value: dashboard.totalEmissions,
        "qudt:hasUnit": "tCO2e",
      },
    },

    ...(dashboard.uncertainty && {
      uncertainty: {
        lower95Percentile: dashboard.uncertainty.lower95,
        upper95Percentile: dashboard.uncertainty.upper95,
      },
    }),

    ...(dashboard.byCategory && {
      byCategory: Object.entries(dashboard.byCategory).map(([category, value]) => ({
        category,
        value,
        unit: "tCO2e",
      })),
    }),
  };
}

/**
 * Export activity records as CSV for bulk import to external systems
 */
export function activityRecordsToCSV(records: ActivityRecordExport[]): string {
  const headers = [
    "id",
    "externalRecordId",
    "category",
    "activityDate",
    "amount",
    "unit",
    "co2eAmount",
    "factorLibrary",
    "quality",
  ];

  const rows = records.map((r) => [
    r.id,
    r.externalRecordId,
    r.emissionCategoryCode,
    r.activityDate.toISOString().split("T")[0],
    r.amount.toFixed(2),
    r.unit,
    r.co2eAmount.toFixed(2),
    r.factorLibraryVersion,
    r.dataQualityFlags.join(";"),
  ]);

  return [headers, ...rows].map((row) => row.map(escapeCSV).join(",")).join("\n");
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Validate API request for authorized data access
 * Called by API routes to enforce data filtering per API key's org scope
 */
export const APIExportRequestSchema = z.object({
  reportingPeriodId: z.string().min(1),
  format: z.enum(["json", "csv", "json-ld"]).default("json"),
  granularity: z.enum(["summary", "detailed"]).default("summary"),
  includeLineage: z.boolean().optional().default(false),
  includeUncertainty: z.boolean().optional().default(false),
  limit: z.number().int().positive().max(10000).optional().default(1000), // Activity record limit
  offset: z.number().int().nonnegative().optional().default(0),
});

export type APIExportRequest = z.infer<typeof APIExportRequestSchema>;

/**
 * Rate-limit guidance for API exports
 * Prevents exfiltration of entire datasets in one request
 */
export const API_EXPORT_RATE_LIMIT = {
  maxRecordsPerRequest: 10000,
  maxRequests: 100,
  windowMinutes: 60,
  description: "100 requests/hour, max 10k records per request",
};
