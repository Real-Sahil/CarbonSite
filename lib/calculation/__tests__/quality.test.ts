import { describe, it, expect } from "vitest";
import { calculateDataQualityScore, calculateConfidenceInterval } from "../quality";
import type { ActivityRecord } from "@prisma/client";

describe("calculateDataQualityScore", () => {
  const baseRecord = {
    id: "test-1",
    organizationId: "org-1",
    reviewStatus: "approved",
    evidenceStatus: "complete",
    fieldSubmissionId: null,
    importBatchId: "batch-1",
    country: "GB",
    activityDate: new Date("2026-06-01"),
    emissionCategory: { scope: 1 },
  } as unknown as ActivityRecord & { emissionCategory: { scope: number } };

  it("scores complete evidence higher than partial", () => {
    const complete = calculateDataQualityScore({
      record: baseRecord,
      factorSelection: { factor: {} as any, selectionReason: "unit compatible" },
      unitConverted: false,
      unitConversionComplex: false,
    });

    const partial = calculateDataQualityScore({
      record: { ...baseRecord, evidenceStatus: "partial" },
      factorSelection: { factor: {} as any, selectionReason: "unit compatible" },
      unitConverted: false,
      unitConversionComplex: false,
    });

    expect(complete.score).toBeGreaterThan(partial.score);
  });

  it("scores field submissions higher than batch imports", () => {
    const fieldSubmission = calculateDataQualityScore({
      record: { ...baseRecord, fieldSubmissionId: "fs-1", importBatchId: null },
      factorSelection: { factor: {} as any, selectionReason: "matched" },
      unitConverted: false,
      unitConversionComplex: false,
    });

    const batchImport = calculateDataQualityScore({
      record: baseRecord,
      factorSelection: { factor: {} as any, selectionReason: "matched" },
      unitConverted: false,
      unitConversionComplex: false,
    });

    expect(fieldSubmission.score).toBeGreaterThan(batchImport.score);
  });

  it("penalizes unit conversions", () => {
    const noConversion = calculateDataQualityScore({
      record: baseRecord,
      factorSelection: { factor: {} as any, selectionReason: "matched" },
      unitConverted: false,
      unitConversionComplex: false,
    });

    const simpleConversion = calculateDataQualityScore({
      record: baseRecord,
      factorSelection: { factor: {} as any, selectionReason: "matched" },
      unitConverted: true,
      unitConversionComplex: false,
    });

    const complexConversion = calculateDataQualityScore({
      record: baseRecord,
      factorSelection: { factor: {} as any, selectionReason: "matched" },
      unitConverted: true,
      unitConversionComplex: true,
    });

    expect(noConversion.score).toBeGreaterThan(simpleConversion.score);
    expect(simpleConversion.score).toBeGreaterThan(complexConversion.score);
  });

  it("heavily penalizes missing factors", () => {
    const withFactor = calculateDataQualityScore({
      record: baseRecord,
      factorSelection: { factor: {} as any, selectionReason: "matched" },
      unitConverted: false,
      unitConversionComplex: false,
    });

    const noFactor = calculateDataQualityScore({
      record: baseRecord,
      factorSelection: null,
      unitConverted: false,
      unitConversionComplex: false,
    });

    expect(withFactor.score).toBeGreaterThan(noFactor.score);
  });

  it("clamps score to 0-100 range", () => {
    const score = calculateDataQualityScore({
      record: baseRecord,
      factorSelection: { factor: {} as any, selectionReason: "matched matched matched" },
      unitConverted: false,
      unitConversionComplex: false,
    });

    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
  });

  it("returns pedigree scores and a geometric standard deviation >= 1", () => {
    const result = calculateDataQualityScore({
      record: baseRecord,
      factorSelection: { factor: {} as any, selectionReason: "matched" },
      unitConverted: false,
      unitConversionComplex: false,
    });

    expect(result.pedigreeScores.reliability).toBeGreaterThanOrEqual(1);
    expect(result.pedigreeScores.reliability).toBeLessThanOrEqual(5);
    expect(result.geometricStdDev).toBeGreaterThanOrEqual(1);
  });
});

describe("calculateConfidenceInterval", () => {
  it("returns tighter intervals for a lower geometric standard deviation", () => {
    const highQuality = calculateConfidenceInterval(100, 1.05);
    const lowQuality = calculateConfidenceInterval(100, 1.5);

    const highMargin = highQuality.upper - highQuality.lower;
    const lowMargin = lowQuality.upper - lowQuality.lower;

    expect(highMargin).toBeLessThan(lowMargin);
  });

  it("collapses to the point estimate when geometric standard deviation is 1", () => {
    const ci = calculateConfidenceInterval(100, 1);
    expect(ci.lower).toBeCloseTo(100);
    expect(ci.upper).toBeCloseTo(100);
  });

  it("is symmetric on a log scale (lower * upper ≈ totalCo2e²)", () => {
    const ci = calculateConfidenceInterval(100, 1.2);
    expect(ci.lower * ci.upper).toBeCloseTo(100 * 100, 4);
  });

  it("prevents negative lower bounds", () => {
    const ci = calculateConfidenceInterval(10, 1.3);
    expect(ci.lower).toBeGreaterThanOrEqual(0);
  });

  it("scales margin width linearly with the CO2e value", () => {
    const ci100 = calculateConfidenceInterval(100, 1.2);
    const ci1000 = calculateConfidenceInterval(1000, 1.2);

    const margin100 = ci100.upper - ci100.lower;
    const margin1000 = ci1000.upper - ci1000.lower;

    expect(margin1000).toBeCloseTo(margin100 * 10, 0);
  });
});
