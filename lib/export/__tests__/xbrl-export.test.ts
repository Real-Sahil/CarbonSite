import { describe, it, expect } from "vitest";
import { generateESRSXBRL, mapCategoryToESRSConcept, dashboardToXBRLFacts } from "../xbrl-export";

describe("XBRL Export", () => {
  it("should generate valid XBRL XML structure", () => {
    const context = {
      organizationName: "Acme Corp",
      reportingPeriodStart: new Date("2026-01-01"),
      reportingPeriodEnd: new Date("2026-12-31"),
      reportingStandard: "csrd" as const,
    };

    const emissions = [
      {
        scope: "1" as const,
        category: "stationary",
        amount: 150.5,
        unit: "tCO2e",
        period: new Date("2026-01-01"),
        methodology: "GHG Protocol",
      },
    ];

    const xbrl = generateESRSXBRL(context, emissions);

    expect(xbrl).toContain('<?xml version="1.0"');
    expect(xbrl).toContain("<xbrl");
    expect(xbrl).toContain("</xbrl>");
    expect(xbrl).toContain("2026-01-01");
    expect(xbrl).toContain("2026-12-31");
  });

  it("should map CarbonSite categories to ESRS concepts", () => {
    const testCases = [
      { input: "s1-stationary", expectedScope: "1" },
      { input: "s1-mobile", expectedScope: "1" },
      { input: "s2-electricity-lb", expectedScope: "2-LB" },
      { input: "s2-electricity-mb", expectedScope: "2-MB" },
      { input: "s3-business-travel", expectedScope: "3" },
      { input: "s3-purchased-goods", expectedScope: "3" },
    ];

    for (const test of testCases) {
      const result = mapCategoryToESRSConcept(test.input);
      expect(result.scope).toBe(test.expectedScope);
      expect(result.concept).toBeDefined();
      expect(result.concept.length).toBeGreaterThan(0);
    }
  });

  it("should handle unknown categories gracefully", () => {
    const result = mapCategoryToESRSConcept("unknown-category");

    expect(result.scope).toBe("3");
    expect(result.concept).toBe("OtherIndirectGHGEmissions");
  });

  it("should convert dashboard aggregates to XBRL facts", () => {
    const aggregates = [
      { scope: "1" as const, value: 100 },
      { scope: "2-LB" as const, value: 50 },
      { scope: "3" as const, value: 200 },
    ];

    const facts = dashboardToXBRLFacts(
      "Test Org",
      aggregates,
      new Date("2026-01-01"),
      new Date("2026-12-31")
    );

    expect(facts).toHaveLength(3);
    expect(facts[0].amount).toBe(100);
    expect(facts[0].unit).toBe("tCO2e");
    expect(facts[1].amount).toBe(50);
  });

  it("should include methodology in XBRL output", () => {
    const context = {
      organizationName: "Test Corp",
      reportingPeriodStart: new Date("2026-01-01"),
      reportingPeriodEnd: new Date("2026-12-31"),
      reportingStandard: "esrs-e5" as const,
    };

    const emissions = [
      {
        scope: "2-LB" as const,
        category: "electricity",
        amount: 75.2,
        unit: "tCO2e",
        period: new Date("2026-06-30"),
        methodology: "Market-based electricity grid",
      },
    ];

    const xbrl = generateESRSXBRL(context, emissions);

    expect(xbrl).toContain("Market-based electricity grid");
    expect(xbrl).toContain("GHGEmissionsMethodology");
  });

  it("should support multiple emissions in one document", () => {
    const context = {
      organizationName: "Multi-Facility Corp",
      reportingPeriodStart: new Date("2026-01-01"),
      reportingPeriodEnd: new Date("2026-12-31"),
      reportingStandard: "csrd" as const,
    };

    const emissions = [
      {
        scope: "1" as const,
        category: "stationary",
        amount: 100,
        unit: "tCO2e",
        period: new Date("2026-01-01"),
        methodology: "GHG Protocol",
      },
      {
        scope: "3" as const,
        category: "upstream",
        amount: 500,
        unit: "tCO2e",
        period: new Date("2026-01-01"),
        methodology: "Spend-based factor",
      },
    ];

    const xbrl = generateESRSXBRL(context, emissions);

    expect(xbrl).toContain("fact_0");
    expect(xbrl).toContain("fact_1");
    expect(xbrl).toContain("100.00");
    expect(xbrl).toContain("500.00");
  });
});
