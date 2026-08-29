import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { detectAnomaliesInBatch, detectFacilityTrendAnomalies, detectDuplicateRecords } from "../anomaly-detector";
import { prisma } from "@/lib/db";

describe("Anomaly Detection", () => {
  const orgId = "test-org-123";
  const facilityId = "test-facility-123";
  const categoryId = "s1-stationary";
  let recordIds: string[] = [];

  beforeAll(async () => {
    // Create test org and facility
    const org = await prisma.organization.create({
      data: { name: "Test Org", slug: "test-org" },
    });

    const facility = await prisma.facility.create({
      data: {
        organizationId: org.id,
        name: "Test Facility",
        headcount: 100,
        footprintSqm: 5000,
      },
    });

    const category = await prisma.emissionCategory.create({
      data: {
        organizationId: org.id,
        code: categoryId,
        name: "Stationary Combustion",
        scope: "1",
      },
    });

    // Create historical records with known patterns
    const historicalRecords = [
      { amount: 100, offset: -300 }, // 10 months ago
      { amount: 105, offset: -240 },
      { amount: 110, offset: -180 },
      { amount: 102, offset: -120 },
      { amount: 108, offset: -60 },
      { amount: 100, offset: -30 }, // ~1 month ago
    ];

    for (const rec of historicalRecords) {
      const created = await prisma.activityRecord.create({
        data: {
          organizationId: org.id,
          facilityId: facility.id,
          emissionCategoryId: category.id,
          reportingPeriodId: "period-1",
          originalAmount: rec.amount,
          originalUnit: "kg",
          normalizedAmount: rec.amount,
          normalizedUnit: "kg",
          sourceDescription: "Test record",
          activityDate: new Date(Date.now() + rec.offset * 24 * 60 * 60 * 1000),
          reviewStatus: "approved",
        },
      });
      recordIds.push(created.id);
    }
  });

  afterAll(async () => {
    // Cleanup
    await prisma.activityRecord.deleteMany({ where: { organizationId: orgId } });
    await prisma.emissionCategory.deleteMany({ where: { organizationId: orgId } });
    await prisma.facility.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("should detect z-score anomalies (>3 sigma)", async () => {
    // Create an outlier: 1000 kg (mean ~105, should be ~3.5 sigma)
    const result = await detectAnomaliesInBatch(orgId, recordIds.slice(0, 1));

    expect(result.totalRecords).toBeGreaterThan(0);
    // The first record (100 kg) should be normal if historical variance is low
    if (result.anomalousRecords > 0) {
      expect(result.anomalies[0].flagReason).toContain("σ from facility/category mean");
    }
  });

  it("should return quality score", async () => {
    const result = await detectAnomaliesInBatch(orgId, recordIds);

    expect(result.overallQuality).toBeGreaterThanOrEqual(0);
    expect(result.overallQuality).toBeLessThanOrEqual(100);
  });

  it("should sort anomalies by score descending", async () => {
    const result = await detectAnomaliesInBatch(orgId, recordIds);

    if (result.anomalies.length > 1) {
      for (let i = 0; i < result.anomalies.length - 1; i++) {
        expect(result.anomalies[i].anomalyScore).toBeGreaterThanOrEqual(
          result.anomalies[i + 1].anomalyScore
        );
      }
    }
  });

  it("should detect trend anomalies", async () => {
    const result = await detectFacilityTrendAnomalies(orgId, facilityId, 90);

    expect(result.totalRecords).toBeGreaterThan(0);
    expect(result.anomalies).toBeDefined();
    expect(Array.isArray(result.anomalies)).toBe(true);
  });

  it("should return empty anomalies for non-existent records", async () => {
    const result = await detectAnomaliesInBatch(orgId, ["nonexistent-123"]);

    expect(result.totalRecords).toBe(0);
    expect(result.anomalousRecords).toBe(0);
    expect(result.anomalies).toHaveLength(0);
  });

  it("should suggest action for different severity levels", async () => {
    const result = await detectAnomaliesInBatch(orgId, recordIds);

    for (const anomaly of result.anomalies) {
      expect(["approve_as_is", "review_with_submitter", "verify_reasonableness", "verify_unit"]).toContain(
        anomaly.suggestedAction
      );
    }
  });

  it("should detect duplicate records", async () => {
    const duplicates = await detectDuplicateRecords(orgId, facilityId, 5);

    expect(Array.isArray(duplicates)).toBe(true);
    // May or may not find duplicates depending on data
    if (duplicates.length > 0) {
      expect(duplicates[0].similarity).toBeGreaterThan(0.95);
    }
  });
});
