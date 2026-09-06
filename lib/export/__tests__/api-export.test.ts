import { describe, it, expect } from "vitest";
import {
  dashboardToJSONLD,
  activityRecordsToCSV,
  APIExportRequestSchema,
  API_EXPORT_RATE_LIMIT,
} from "../api-export";

describe("API Export", () => {
  it("should convert dashboard to JSON-LD format", () => {
    const dashboard = {
      organizationId: "org-123",
      reportingPeriodId: "period-2026",
      publishedAt: new Date("2026-12-31"),
      methodology: "GHG Protocol",
      dataQualityScore: 0.85,
      scope1: 150.5,
      scope2LB: 75.2,
      scope2MB: 80.0,
      scope3: 500.0,
      totalEmissions: 805.7,
    };

    const jsonld = dashboardToJSONLD(dashboard);

    expect(jsonld["@context"]).toBeDefined();
    expect(jsonld["@type"]).toBe("EmissionInventory");
    expect((jsonld as any).emissions).toBeDefined();
    expect((jsonld as any).emissions.scope1.value).toBe(150.5);
    expect((jsonld as any).emissions.total.value).toBe(805.7);
  });

  it("should include uncertainty when provided", () => {
    const dashboard = {
      organizationId: "org-123",
      reportingPeriodId: "period-2026",
      publishedAt: new Date("2026-12-31"),
      methodology: "GHG Protocol",
      dataQualityScore: 0.75,
      scope1: 100,
      scope2LB: 50,
      scope2MB: 55,
      scope3: 300,
      totalEmissions: 505,
      uncertainty: { lower95: 480, upper95: 530 },
    };

    const jsonld = dashboardToJSONLD(dashboard);

    expect((jsonld as any).uncertainty).toBeDefined();
    expect((jsonld as any).uncertainty.lower95Percentile).toBe(480);
    expect((jsonld as any).uncertainty.upper95Percentile).toBe(530);
  });

  it("should include category breakdown when provided", () => {
    const dashboard = {
      organizationId: "org-123",
      reportingPeriodId: "period-2026",
      publishedAt: new Date("2026-12-31"),
      methodology: "GHG Protocol",
      dataQualityScore: 0.8,
      scope1: 200,
      scope2LB: 100,
      scope2MB: 100,
      scope3: 600,
      totalEmissions: 1000,
      byCategory: {
        "s1-mobile": 150,
        "s1-stationary": 50,
        "s2-electricity-lb": 100,
        "s3-purchased-goods": 400,
        "s3-business-travel": 200,
      },
    };

    const jsonld = dashboardToJSONLD(dashboard);

    expect((jsonld as any).byCategory).toBeDefined();
    expect((jsonld as any).byCategory).toHaveLength(5);
    expect((jsonld as any).byCategory[0].category).toBe("s1-mobile");
    expect((jsonld as any).byCategory[0].value).toBe(150);
  });

  it("should convert activity records to CSV", () => {
    const records = [
      {
        id: "rec-1",
        externalRecordId: "INV-001",
        emissionCategoryCode: "s1-mobile",
        activityDate: new Date("2026-06-15"),
        amount: 500,
        unit: "litres",
        co2eAmount: 1.25,
        calculationFormula: "500 * 0.0025",
        factorId: "factor-diesel-uk",
        factorLibraryVersion: "DEFRA-2025",
        dataQualityFlags: ["spend-based"],
      },
      {
        id: "rec-2",
        externalRecordId: "METER-001",
        emissionCategoryCode: "s2-electricity-lb",
        activityDate: new Date("2026-06-30"),
        amount: 1000,
        unit: "kWh",
        co2eAmount: 0.2,
        calculationFormula: "1000 * 0.0002",
        factorId: "factor-electricity-sw-london",
        factorLibraryVersion: "DEFRA-2025",
        dataQualityFlags: [],
      },
    ];

    const csv = activityRecordsToCSV(records);

    expect(csv).toContain("id,externalRecordId,category");
    expect(csv).toContain("rec-1");
    expect(csv).toContain("INV-001");
    expect(csv).toContain("s1-mobile");
    expect(csv).toContain("2026-06-15");
    expect(csv).toContain("500.00");
    expect(csv).toContain("1.25");
    expect(csv).toContain("DEFRA-2025");
    expect(csv).toContain("spend-based");
  });

  it("should escape CSV special characters", () => {
    const records = [
      {
        id: "rec-1",
        externalRecordId: "INV,001",
        emissionCategoryCode: "s3-purchased-goods",
        activityDate: new Date("2026-01-01"),
        amount: 100,
        unit: "kg",
        co2eAmount: 2.5,
        calculationFormula: "100 * 0.025",
        factorId: "factor-1",
        factorLibraryVersion: "v1",
        dataQualityFlags: ["has,comma"],
      },
    ];

    const csv = activityRecordsToCSV(records);

    // Should escape commas in quoted fields
    expect(csv).toContain('"INV,001"');
    expect(csv).toContain('"has,comma"');
  });

  it("should validate API export request schema", () => {
    const validRequest = {
      reportingPeriodId: "period-2026",
      format: "json" as const,
      granularity: "summary" as const,
    };

    const result = APIExportRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it("should enforce request limits", () => {
    const requestWithTooManyRecords = {
      reportingPeriodId: "period-2026",
      limit: 20000, // Exceeds max
    };

    const result = APIExportRequestSchema.safeParse(requestWithTooManyRecords);
    expect(result.success).toBe(false);
  });

  it("should apply defaults to API export request", () => {
    const minimalRequest = {
      reportingPeriodId: "period-2026",
    };

    const result = APIExportRequestSchema.safeParse(minimalRequest);
    expect(result.success).toBe(true);
    expect(result.data?.format).toBe("json");
    expect(result.data?.granularity).toBe("summary");
    expect(result.data?.limit).toBe(1000);
  });

  it("should define API rate limiting", () => {
    expect(API_EXPORT_RATE_LIMIT.maxRecordsPerRequest).toBe(10000);
    expect(API_EXPORT_RATE_LIMIT.maxRequests).toBe(100);
    expect(API_EXPORT_RATE_LIMIT.windowMinutes).toBe(60);
    expect(API_EXPORT_RATE_LIMIT.description).toBeDefined();
  });

  it("should format JSON-LD with proper semantic annotations", () => {
    const dashboard = {
      organizationId: "org-123",
      reportingPeriodId: "period-2026",
      publishedAt: new Date("2026-12-31"),
      methodology: "GHG Protocol",
      dataQualityScore: 0.9,
      scope1: 100,
      scope2LB: 50,
      scope2MB: 50,
      scope3: 200,
      totalEmissions: 400,
    };

    const jsonld = dashboardToJSONLD(dashboard);

    // Verify JSON-LD structure
    expect((jsonld as any).emissions.scope1["@type"]).toBe("qudt:QuantityValue");
    expect((jsonld as any).emissions.scope1["qudt:hasUnit"]).toBe("tCO2e");
    expect((jsonld as any)["@id"]).toContain("urn:metricora");
  });
});
