import { describe, it, expect } from "vitest";
import {
  validateScope2Compliance,
  recordScope2ComplianceAudit,
  getScope2FactorFallbackChain,
  validateScope2ReportingCompliance,
} from "../scope2-rules";

describe("Scope 2 Compliance Rules — GHG Protocol Dual-Reporting", () => {
  describe("validateScope2Compliance", () => {
    it("requires dual reporting when both factors available", () => {
      const result = validateScope2Compliance({
        category: "electricity_location_based",
        locationBasedFactorId: "DEFRA_2025_ELEC_LB",
        marketBasedFactorId: "DEFRA_2025_ELEC_MB",
        country: "GB",
        activityType: "grid",
      });

      expect(result.isCompliant).toBe(true);
      expect(result.method).toBe("dual");
      expect(result.marketFactorStatus).toBe("available");
      expect(result.reason).toContain("dual reporting required");
    });

    it("allows location-based only when market factor unavailable", () => {
      const result = validateScope2Compliance({
        category: "electricity_location_based",
        locationBasedFactorId: "DEFRA_2025_ELEC_LB",
        marketBasedFactorId: null,
        country: "GB",
      });

      expect(result.isCompliant).toBe(true);
      expect(result.method).toBe("location_based_only");
      expect(result.marketFactorStatus).toBe("fallback_applied");
      expect(result.reason).toContain("location-based used as fallback");
    });

    it("fails when no location-based factor available", () => {
      const result = validateScope2Compliance({
        category: "electricity_location_based",
        locationBasedFactorId: null,
        marketBasedFactorId: "DEFRA_2025_ELEC_MB",
        country: "GB",
      });

      expect(result.isCompliant).toBe(false);
      expect(result.method).toBe("location_based_only");
      expect(result.reason).toContain("No location-based factor");
    });

    it("skips dual-reporting for non-electricity categories", () => {
      const result = validateScope2Compliance({
        category: "stationary_fuel",
        locationBasedFactorId: "DEFRA_2025_NG",
        marketBasedFactorId: null,
      });

      expect(result.isCompliant).toBe(true);
      expect(result.method).toBe("location_based_only");
      expect(result.reason).toContain("Non-electricity");
      expect(result.marketFactorStatus).toBe("not_available");
    });
  });

  describe("recordScope2ComplianceAudit", () => {
    it("records dual-reporting audit trail with lifecycle stages", () => {
      const record = recordScope2ComplianceAudit({
        activityRecordId: "rec_123",
        emissionCalculationId: "calc_456",
        locationBasedTotalCo2e: 233,
        marketBasedTotalCo2e: 50,
        locationBasedFactorId: "DEFRA_2025_ELEC_LB",
        marketBasedFactorId: "DEFRA_2025_ELEC_MB",
        reportingMethod: "dual",
        marketFactorAvailability: "available",
        country: "GB",
        activityType: "grid",
      });

      expect(record.activityRecordId).toBe("rec_123");
      expect(record.emissionCalculationId).toBe("calc_456");
      expect(record.locationBasedTotalCo2e).toBe(233);
      expect(record.marketBasedTotalCo2e).toBe(50);
      expect(record.reportingMethod).toBe("dual");

      // Verify lifecycle stages
      expect(record.lifecycle).toHaveLength(3);
      expect(record.lifecycle[0].stage).toBe("pre_calculation");
      expect(record.lifecycle[1].stage).toBe("runtime_inference");
      expect(record.lifecycle[2].stage).toBe("post_audit");

      // Verify compliance notes
      expect(record.complianceNotes).toContain("dual reporting");
      expect(record.complianceNotes).toContain("233.00 kg");
      expect(record.complianceNotes).toContain("50.00 kg");
    });

    it("records fallback rationale for location-based only", () => {
      const record = recordScope2ComplianceAudit({
        activityRecordId: "rec_789",
        emissionCalculationId: "calc_101",
        locationBasedTotalCo2e: 233,
        locationBasedFactorId: "DEFRA_2025_ELEC_LB",
        reportingMethod: "location_based_only",
        marketFactorAvailability: "fallback_applied",
        fallbackReason: "No market-based factor for US regional grid",
        country: "US",
      });

      expect(record.reportingMethod).toBe("location_based_only");
      expect(record.marketFactorAvailability).toBe("fallback_applied");
      expect(record.fallbackReason).toContain("market-based factor");
      expect(record.complianceNotes).toContain("Market-based factor unavailable");
      expect(record.complianceNotes).toContain("location-based only");
    });

    it("includes lifecycle validations for audit trail", () => {
      const record = recordScope2ComplianceAudit({
        activityRecordId: "rec_123",
        emissionCalculationId: "calc_456",
        locationBasedTotalCo2e: 233,
        marketBasedTotalCo2e: 50,
        locationBasedFactorId: "DEFRA_2025_ELEC_LB",
        marketBasedFactorId: "DEFRA_2025_ELEC_MB",
        reportingMethod: "dual",
        marketFactorAvailability: "available",
        activityType: "grid",
        country: "GB",
      });

      const postAuditStage = record.lifecycle.find((s) => s.stage === "post_audit");
      expect(postAuditStage).toBeDefined();
      expect(postAuditStage?.validations).toContain("Reporting method: dual");
      expect(postAuditStage?.validations).toContain("Location-based CO2e: 233 kg");
      expect(postAuditStage?.validations).toContain("Market-based CO2e: 50 kg");
    });
  });

  describe("getScope2FactorFallbackChain", () => {
    it("generates deterministic fallback priority chain", () => {
      const chain = getScope2FactorFallbackChain("GB", "grid");

      expect(chain).toHaveLength(4);
      expect(chain[0].priority).toBe(1);
      expect(chain[0].description).toContain("Exact match");
      expect(chain[0].description).toContain("GB");
      expect(chain[0].description).toContain("grid");

      expect(chain[1].priority).toBe(2);
      expect(chain[1].description).toContain("Geography match");

      expect(chain[3].priority).toBe(4);
      expect(chain[3].description).toContain("Global default");
    });

    it("handles undefined country and activity type", () => {
      const chain = getScope2FactorFallbackChain(undefined, undefined);

      expect(chain[0].description).toContain("global");
      expect(chain[0].description).toContain("default");
    });
  });

  describe("validateScope2ReportingCompliance", () => {
    it("validates full dual-reporting compliance", () => {
      const records = [
        {
          activityRecordId: "rec_1",
          emissionCalculationId: "calc_1",
          locationBasedTotalCo2e: 233,
          marketBasedTotalCo2e: 50,
          locationBasedFactorId: "LB_1",
          marketBasedFactorId: "MB_1",
          reportingMethod: "dual" as const,
          marketFactorAvailability: "available" as const,
          lifecycle: [],
          complianceNotes: "Dual reporting",
        },
        {
          activityRecordId: "rec_2",
          emissionCalculationId: "calc_2",
          locationBasedTotalCo2e: 150,
          marketBasedTotalCo2e: 45,
          locationBasedFactorId: "LB_2",
          marketBasedFactorId: "MB_2",
          reportingMethod: "dual" as const,
          marketFactorAvailability: "available" as const,
          lifecycle: [],
          complianceNotes: "Dual reporting",
        },
      ];

      const validation = validateScope2ReportingCompliance(records);

      expect(validation.compliant).toBe(true);
      expect(validation.dualReportingCount).toBe(2);
      expect(validation.locationOnlyCount).toBe(0);
      expect(validation.recommendations).toHaveLength(0);
    });

    it("flags mixed reporting with recommendations", () => {
      const records = [
        {
          activityRecordId: "rec_1",
          emissionCalculationId: "calc_1",
          locationBasedTotalCo2e: 233,
          marketBasedTotalCo2e: 50,
          locationBasedFactorId: "LB_1",
          marketBasedFactorId: "MB_1",
          reportingMethod: "dual" as const,
          marketFactorAvailability: "available" as const,
          lifecycle: [],
          complianceNotes: "Dual reporting",
        },
        {
          activityRecordId: "rec_2",
          emissionCalculationId: "calc_2",
          locationBasedTotalCo2e: 150,
          locationBasedFactorId: "LB_2",
          reportingMethod: "location_based_only" as const,
          marketFactorAvailability: "fallback_applied" as const,
          lifecycle: [],
          complianceNotes: "Location-based fallback",
        },
      ];

      const validation = validateScope2ReportingCompliance(records);

      expect(validation.dualReportingCount).toBe(1);
      expect(validation.locationOnlyCount).toBe(1);
      expect(validation.recommendations.length).toBeGreaterThan(0);
      expect(validation.recommendations[0]).toContain("records using location-based only");
    });

    it("identifies location-based only with no dual reporting", () => {
      const records = [
        {
          activityRecordId: "rec_1",
          emissionCalculationId: "calc_1",
          locationBasedTotalCo2e: 233,
          locationBasedFactorId: "LB_1",
          reportingMethod: "location_based_only" as const,
          marketFactorAvailability: "not_available" as const,
          lifecycle: [],
          complianceNotes: "No market factors",
        },
        {
          activityRecordId: "rec_2",
          emissionCalculationId: "calc_2",
          locationBasedTotalCo2e: 150,
          locationBasedFactorId: "LB_2",
          reportingMethod: "location_based_only" as const,
          marketFactorAvailability: "not_available" as const,
          lifecycle: [],
          complianceNotes: "No market factors",
        },
      ];

      const validation = validateScope2ReportingCompliance(records);

      expect(validation.compliant).toBe(false);
      expect(validation.dualReportingCount).toBe(0);
      expect(validation.locationOnlyCount).toBe(2);
      expect(validation.recommendations.length).toBeGreaterThan(0);
      expect(validation.recommendations.some((r) => r.includes("No dual reporting detected"))).toBe(true);
    });
  });

  describe("GHG Protocol Scope 2 Compliance Integration", () => {
    it("validates end-to-end Scope 2 workflow", () => {
      // 1. Pre-calculation validation
      const validation = validateScope2Compliance({
        category: "electricity_location_based",
        locationBasedFactorId: "DEFRA_2025_ELEC_LB",
        marketBasedFactorId: "DEFRA_2025_ELEC_MB",
        country: "GB",
        activityType: "grid",
      });

      expect(validation.isCompliant).toBe(true);
      expect(validation.method).toBe("dual");

      // 2. Post-calculation audit
      const audit = recordScope2ComplianceAudit({
        activityRecordId: "rec_001",
        emissionCalculationId: "calc_001",
        locationBasedTotalCo2e: 233,
        marketBasedTotalCo2e: 50,
        locationBasedFactorId: "DEFRA_2025_ELEC_LB",
        marketBasedFactorId: "DEFRA_2025_ELEC_MB",
        reportingMethod: "dual",
        marketFactorAvailability: "available",
      });

      expect(audit.reportingMethod).toBe("dual");
      expect(audit.lifecycle).toHaveLength(3);

      // 3. Reporting compliance
      const reporting = validateScope2ReportingCompliance([audit]);

      expect(reporting.compliant).toBe(true);
      expect(reporting.dualReportingCount).toBe(1);
    });
  });
});
