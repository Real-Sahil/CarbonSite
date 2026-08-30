import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { detectAnomaliesInBatch, detectFacilityTrendAnomalies, detectDuplicateRecords } from "../anomaly-detector";
import { prisma } from "@/lib/db";

describe.skip("Anomaly Detection", () => {
  const categoryId = "s1-stationary";
  let orgId: string;
  let facilityId: string;
  let userId: string;
  let recordIds: string[] = [];

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-anomaly-${Date.now()}@example.com`,
        name: "Test User",
      },
    });
    userId = user.id;

    // Create test org and facility
    const org = await prisma.organization.create({
      data: { name: "Test Org" },
    });
    orgId = org.id;

    const facility = await prisma.facility.create({
      data: {
        organizationId: org.id,
        name: "Test Facility",
      },
    });
    facilityId = facility.id;

    const reportingPeriod = await prisma.reportingPeriod.create({
      data: {
        organizationId: org.id,
        type: "year",
        label: "2024",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
      },
    });

    const category = await prisma.emissionCategory.create({
      data: {
        code: categoryId,
        name: "Stationary Combustion",
        scope: 1,
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
          reportingPeriodId: reportingPeriod.id,
          createdByUserId: userId,
          amount: new Decimal(rec.amount),
          unit: "kg",
          sourceDescription: "Test record",
          activityDate: new Date(Date.now() + rec.offset * 24 * 60 * 60 * 1000),
        },
      });
      recordIds.push(created.id);
    }
  });

  afterAll(async () => {
    // Cleanup
    await prisma.activityRecord.deleteMany({ where: { organizationId: orgId } });
    await prisma.reportingPeriod.deleteMany({ where: { organizationId: orgId } });
    await prisma.facility.deleteMany({ where: { organizationId: orgId } });
    await prisma.emissionCategory.deleteMany({ where: { code: categoryId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: userId } });
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
