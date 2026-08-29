import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import {
  estimateScope3Energy,
  estimateScope3Waste,
  estimateScope3Water,
  storeScope3Estimate,
  getScope3Estimates,
} from "../scope3-estimator";
import { prisma } from "@/lib/db";

describe("Scope 3 Estimation", () => {
  let orgId: string;
  let facilityId: string;
  let categoryId: string;
  let reportingPeriodId: string;
  let userId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-scope3-${Date.now()}@example.com`,
        name: "Test User",
      },
    });
    userId = user.id;

    // Create test org, facility, and category
    const org = await prisma.organization.create({
      data: { name: "Test Org Scope3" },
    });
    orgId = org.id;

    const facility = await prisma.facility.create({
      data: {
        organizationId: org.id,
        name: "Manufacturing Facility",
        country: "GB",
      },
    });
    facilityId = facility.id;

    const reportingPeriod = await prisma.reportingPeriod.create({
      data: {
        organizationId: org.id,
        type: "year",
        label: "Test Period",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
      },
    });
    reportingPeriodId = reportingPeriod.id;

    const category = await prisma.emissionCategory.create({
      data: {
        code: "s3-energy-consumption",
        name: "Scope 3 Energy",
        scope: 3,
      },
    });
    categoryId = category.id;

    // Create some historical data for estimation context
    for (let i = 0; i < 10; i++) {
      await prisma.activityRecord.create({
        data: {
          organizationId: org.id,
          facilityId: facility.id,
          emissionCategoryId: category.id,
          reportingPeriodId: reportingPeriod.id,
          createdByUserId: userId,
          amount: new Decimal(5000 + Math.random() * 2000),
          unit: "kWh",
          sourceDescription: "Utility bill",
          activityDate: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
  });

  afterAll(async () => {
    // Cleanup
    await prisma.activityRecord.deleteMany({ where: { organizationId: orgId } });
    await prisma.reportingPeriod.deleteMany({ where: { organizationId: orgId } });
    await prisma.facility.deleteMany({ where: { organizationId: orgId } });
    await prisma.scope3Estimate.deleteMany({ where: { organizationId: orgId } });
    await prisma.emissionCategory.deleteMany({ where: { code: "s3-energy-consumption" } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: userId } });
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
          facilitId: facilityId,
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
