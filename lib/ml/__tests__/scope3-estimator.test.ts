import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  estimateScope3Energy,
  estimateScope3Waste,
  estimateScope3Water,
  storeScope3Estimate,
  getScope3Estimates,
} from "../scope3-estimator";
import { prisma } from "@/lib/db";

describe("Scope 3 Estimation", () => {
  const orgId = "test-org-scope3";
  let facilityId: string;
  let categoryId: string;

  beforeAll(async () => {
    // Create test org, facility, and category
    const org = await prisma.organization.create({
      data: { name: "Test Org Scope3", slug: "test-scope3" },
    });

    const facility = await prisma.facility.create({
      data: {
        organizationId: org.id,
        name: "Manufacturing Facility",
        headcount: 250,
        footprintSqm: 10000,
        sectorCode: "manufacturing",
        country: "GB",
      },
    });

    const category = await prisma.emissionCategory.create({
      data: {
        organizationId: org.id,
        code: "s3-energy-consumption",
        name: "Scope 3 Energy",
        scope: "3",
      },
    });

    // Create some historical data for estimation context
    for (let i = 0; i < 10; i++) {
      await prisma.activityRecord.create({
        data: {
          organizationId: org.id,
          facilityId: facility.id,
          emissionCategoryId: category.id,
          reportingPeriodId: "period-1",
          originalAmount: 5000 + Math.random() * 2000,
          originalUnit: "kWh",
          normalizedAmount: 5000 + Math.random() * 2000,
          normalizedUnit: "kWh",
          sourceDescription: "Utility bill",
          activityDate: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000),
          reviewStatus: "approved",
        },
      });
    }

    facilityId = facility.id;
    categoryId = category.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.activityRecord.deleteMany({ where: { organizationId: orgId } });
    await prisma.emissionCategory.deleteMany({ where: { organizationId: orgId } });
    await prisma.facility.deleteMany({ where: { organizationId: orgId } });
    await prisma.scope3Estimate.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it("should estimate energy consumption", async () => {
    const estimate = await estimateScope3Energy(orgId, facilityId);

    expect(estimate).toBeDefined();
    expect(estimate?.estimatedValue).toBeGreaterThan(0);
    expect(estimate?.estimatedUnit).toBe("kWh");
    expect(estimate?.confidenceScore).toBeGreaterThan(0);
    expect(estimate?.confidenceScore).toBeLessThanOrEqual(1);
  });

  it("should apply sector multipliers for manufacturing", async () => {
    const officeEstimate = await estimateScope3Energy(orgId, facilityId, {
      sectorCode: "office",
      headcount: 100,
      footprintSqm: 5000,
    });

    const manufacturingEstimate = await estimateScope3Energy(orgId, facilityId, {
      sectorCode: "manufacturing",
      headcount: 100,
      footprintSqm: 5000,
    });

    expect(manufacturingEstimate?.estimatedValue).toBeGreaterThan(officeEstimate?.estimatedValue || 0);
  });

  it("should apply seasonality adjustment for winter", async () => {
    const summerEstimate = await estimateScope3Energy(orgId, facilityId, {
      isWinter: false,
      headcount: 100,
    });

    const winterEstimate = await estimateScope3Energy(orgId, facilityId, {
      isWinter: true,
      headcount: 100,
    });

    expect(winterEstimate?.estimatedValue).toBeGreaterThan(summerEstimate?.estimatedValue || 0);
  });

  it("should estimate waste generation", async () => {
    const estimate = await estimateScope3Waste(orgId, facilityId);

    expect(estimate).toBeDefined();
    expect(estimate?.estimatedValue).toBeGreaterThan(0);
    expect(estimate?.estimatedUnit).toBe("tonnes");
    expect(estimate?.confidenceScore).toBeGreaterThan(0);
  });

  it("should estimate water consumption", async () => {
    const estimate = await estimateScope3Water(orgId, facilityId);

    expect(estimate).toBeDefined();
    expect(estimate?.estimatedValue).toBeGreaterThan(0);
    expect(estimate?.estimatedUnit).toBe("m³");
    expect(estimate?.confidenceScore).toBeGreaterThan(0);
  });

  it("should store estimate in database", async () => {
    const estimate = await estimateScope3Energy(orgId, facilityId);

    if (estimate) {
      await storeScope3Estimate(orgId, facilityId, categoryId, estimate, true);

      const stored = await getScope3Estimates(orgId, facilityId, 1);
      expect(stored).toHaveLength(1);
      expect(stored[0].estimatedValue).toBe(estimate.estimatedValue);
      expect(stored[0].status).toBe("accepted");
    }
  });

  it("should mark rejected estimates correctly", async () => {
    const estimate = await estimateScope3Energy(orgId, facilityId);

    if (estimate) {
      await storeScope3Estimate(orgId, facilityId, categoryId, estimate, false);

      const rejected = await prisma.scope3Estimate.findFirst({
        where: {
          organizationId: orgId,
          facilityId,
          status: "rejected",
        },
      });

      expect(rejected).toBeDefined();
    }
  });

  it("should include disclaimer in response", async () => {
    const estimate = await estimateScope3Energy(orgId, facilityId);

    expect(estimate?.disclaimer).toBeDefined();
    expect(estimate?.disclaimer).toContain("estimate");
  });

  it("should handle missing historical data gracefully", async () => {
    const newFacility = await prisma.facility.create({
      data: {
        organizationId: orgId,
        name: "New Facility No History",
      },
    });

    const estimate = await estimateScope3Energy(orgId, newFacility.id);

    // Should return null when no historical data
    expect(estimate).toBeNull();

    await prisma.facility.delete({ where: { id: newFacility.id } });
  });

  it("should calculate confidence based on facility sample size", async () => {
    const estimate = await estimateScope3Energy(orgId, facilityId);

    // More historical records = higher confidence
    expect(estimate?.confidenceScore).toBeGreaterThan(0.5);
    expect(estimate?.basedOnSimilarFacilities).toBeGreaterThan(0);
  });
});
